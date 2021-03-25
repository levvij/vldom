# VLDOM
Simple component system with integrated routing

## Setup
You'll need to enable jsx in your tsconfig
<pre>{
	"compileOnSave": false,
	"compilerOptions": {
		<b>"jsx": "react",
		"jsxFactory": "this.createElement",</b>
		....
	}
}</pre>

## Usage
Create a component by extending the component class

```
export class ExampleComponent extends Component {
	constuctor() {
		super();
	}

	render() {
		return <section>
			Example Component!
		</section>;
	}
}

new ExampleComponent().host(document.body);
```

Let's extends this by creating a recursive component

```
export class ExampleRecursiveComponent extends Component {
	constuctor(private index: number) {
		super();
	}

	render() {
		return <section>
			Component {this.index}

			{index > 0 && new ExampleRecursiveComponent(index - 1)}
		</section>;
	}
}

new ExampleRecursiveComponent(10).host(document.body);
```

## Directives
You can create custom directives (attribute handlers).

```
Component.directives["epic-link"] = (element, value) => {
	element.onclick = () => {
		location.href = value;
	}
}

export class ExampleComponent extends Component {
	constuctor() {
		super();
	}

	render() {
		return <section>
			Test <a epic-link="http://github.com/">Link</a>
		</section>;
	}
}

new ExampleComponent().host(document.body);
```