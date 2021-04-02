import { Component } from "./component";
import { ConstructedRoute } from "./constructed-route";
import { RouteGroup } from "./route-group";
import { Route } from "./route";

export class Router {
	rootNode: Node;

	private renderedPath: string;
	private renderedRoute: ConstructedRoute;
	private renderedParams: any[];

	private constructedRoutes: ConstructedRoute[] = [];

	static routes: {
		[ key: string ]: RouteGroup;
	} = {};

	get activePath() {
		return location.hash.replace("#", "");
	}

	set activePath(value: string) {
		location.hash = `#${value}`;
	}

	navigate(path: string, relative?: Component) {
		this.activePath = this.absolute(path, relative);

		this.update();
	}

	absolute(path: string, relative?: Component) {
		if (path[0] == "/") {
			return path;
		} else if (relative) {
			return this.resolve(`${relative.activeRoute.fullPath}/${path}`);
		} else {
			return this.resolve(`${this.activePath}/${path}`);
		}
	}

	resolve(path: string) {
		const resolved = [];

		for (let component of path.split("/")) {
			if (component && component != ".") {
				if (component == "..") {
					resolved.pop();
				} else {
					resolved.push(component);
				}
			}
		}

		return `/${resolved.join("/")}`;
	}

	private getActiveRoute() {
		const path = this.activePath;

		for (let route of this.constructedRoutes) {
			if (route.path.test(path)) {
				return route;
			}
		}

		throw new Error(`invalid route '${path}'`);
	}

	private getActiveParams(path: string, activeRoute: ConstructedRoute) {
		const items: { [key: string]: string }[] = [];

		let route = activeRoute;

		while (route) {
			const item = {};

			const matches = path.match(route.openStartPath).slice(1);

			for (let i = 0; i < route.params.length; i++) {
				item[route.params[i]] = matches[i];
			}

			items.unshift(item);

			path = path.replace(route.openStartPath, "");
			route = route.parent;
		}

		return items;
	}

	async update() {
		const path = this.activePath;

		if (this.renderedPath == path) {
			return;
		}

		const updatedRoute = this.getActiveRoute();
		const updatedParams = this.getActiveParams(path, updatedRoute);

		const matchingRoutePath = this.renderedRoute ? this.getMatchingRoutePath(updatedRoute, updatedParams) : [];

		const elementLayers: Node[] = [];

		for (let l = 0; l < updatedRoute.parents.length; l++) {
			elementLayers.push(document.createComment(updatedRoute.parents[l].component.name));
		}

		// for (let l = updatedRoute.parents.length - 1; l >= 0; l--) {
		for (let l = 0; l < updatedRoute.parents.length; l++) {
			const layer = updatedRoute.parents[l];
			const parentLayer = updatedRoute.parents[l - 1];
			const params = updatedParams[l];

			layer.clientRoute.path = layer.clientRoute.matchingPath;

			for (let key in params) {
				layer.clientRoute.path = layer.clientRoute.path.replace(`:${key}`, params[key]);
			}

			console.group("layer", l, layer.clientRoute.path, layer.component.name, params);

			if (this.renderedRoute && l == matchingRoutePath.length && layer == this.renderedRoute.parents[l]) {
				console.log("% onchange");

				layer.renderedComponent.params = params;
				layer.renderedComponent.activeRoute = layer.clientRoute;
				layer.renderedComponent.parent = parentLayer?.renderedComponent;
				
				layer.renderedComponent.onchange(params).then(() => {
					layer.renderedComponent.update(layer.renderedChildNode);
				});
			} else if (l < matchingRoutePath.length) {
				const nextLayer = updatedRoute.parents[l + 1];

				layer.renderedComponent.params = params;
				layer.renderedComponent.activeRoute = layer.clientRoute;
				layer.renderedComponent.parent = parentLayer?.renderedComponent;

				if (this.renderedRoute && nextLayer && layer == this.renderedRoute.parents[l] && nextLayer != this.renderedRoute.parents[l + 1]) {
					console.log("& onchange");

					layer.renderedComponent.onchange(params).then(() => {
						layer.renderedComponent.update(elementLayers[l + 1]);
					});
				} else {
					console.log("& onchildchange");

					layer.renderedComponent.onchildchange(params, layer.clientRoute, layer.renderedComponent);
				}
			} else {
				const component = new layer.component();
				component.params = params;
				component.activeRoute = layer.clientRoute;
				component.parent = parentLayer?.renderedComponent;

				layer.renderedComponent = component;

				console.log("+ create");

				requestAnimationFrame(() => {
					component.onload().then(() => {
						Component.renderingComponent = component;
						const node = component.render(elementLayers[l + 1]);
	
						component.rootNode = node;
	
						layer.renderedRoot = node;
	
						if (updatedRoute.parents[l - 1]) {
							updatedRoute.parents[l - 1].renderedChildNode = node;
						}

						if (elementLayers[l].parentNode) {
							elementLayers[l].parentNode.replaceChild(node, elementLayers[l]);
						}
						
						elementLayers[l] = node;
					});
				});
			}

			console.groupEnd();
		}

		if (!this.renderedRoute) {
			this.rootNode.appendChild(elementLayers[0]);
		}

		this.renderedPath = path;
		this.renderedRoute = updatedRoute;
		this.renderedParams = updatedParams;

		console.groupEnd();
	}

	getMatchingRoutePath(updatedRoute: ConstructedRoute, updatedParams) {
		const unchangedRoutes: ConstructedRoute[] = [];

		for (let i = 0; i < updatedRoute.parents.length; i++) {
			if (this.renderedRoute.parents[i] && this.renderedRoute.parents[i] == updatedRoute.parents[i]) {
				for (let key in updatedParams[i]) {
					if (this.renderedParams[i][key] != updatedParams[i][key]) {
						return unchangedRoutes;
					}
				}

				unchangedRoutes.push(updatedRoute.parents[i]);
			} else {
				return unchangedRoutes;
			}
		}

		return unchangedRoutes;
	}

	constructRoutes(root, routes = Router.routes, parent: ConstructedRoute = null) {
		for (let path in routes) {
			const route = routes[path];

			const constructedRoute = {
				path: new RegExp(`^${`${root}${path}`.split("/").join("\\/").replace(/:[a-zA-Z0-9]+/g, "(.[^\\/]+)")}$`),
				openStartPath: new RegExp(`${`${path}`.split("/").join("\\/").replace(/:[a-zA-Z0-9]+/g, "(.[^\\/]+)")}$`),
				component: typeof route == "function" ? route : (route as any).component,
				parent: parent,
				params: (path.match(/:[a-zA-Z0-9]+/g) || []).map(key => key.replace(":", "")),
				parents: [],
				clientRoute: new Route()
			}

			constructedRoute.clientRoute.matchingPath = path;
			constructedRoute.clientRoute.parent = parent && parent.clientRoute;

			this.constructedRoutes.push(constructedRoute);

			if (!(typeof route == "function") && (route as any).children) {
				this.constructRoutes(`${root}${path}`, (route as any).children, constructedRoute);
			}
		}

		if (routes == Router.routes) {
			for (let route of this.constructedRoutes) {
				let item = route;

				while (item) {
					route.parents.unshift(item);

					item = item.parent;
				}
			}
		}
	}

	host(root: Node) {
		this.constructRoutes("");

		this.rootNode = root;

		this.update();
	}
}