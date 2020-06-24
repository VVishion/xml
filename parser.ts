import { TokenTypes, Token, Cursor } from './lexer';
import Serializer from './serializer';

const serializer = new Serializer();

class ParseError extends Error {
	public constructor(message: string, cursor?: Cursor, expected?: string | undefined, got?: string | undefined) {
		super(`${ message }${ cursor ? ` at ${ cursor }` : `` }.${ expected != undefined ? ` expected: "${ expected }"` : `` }${ got != undefined ? `${ expected ? `,` : `` } got: "${ got }"` : `` }`);
		this.name = 'ParseError';
	}
}

export enum NodeTypes {
	Text = 'text',
	Element = 'element'
}

export class Node {
	public type: NodeTypes;
	public parent: Element;
}

export class Text extends Node {
	public type = NodeTypes.Text;

	public value: string;

	public constructor(value: string) {
		super();

		this.value = value;
	}


	public static isText(node: Node): node is Text {
		return node.type === NodeTypes.Text;
	}
}

type Attributes = { [name: string]: string | undefined };

export class Element extends Node {
	public type = NodeTypes.Element;

	public name: string;
	public attributes: Attributes;

	public children: Node[];

	public constructor(name: string) {
		super();

		this.name = name;
		this.children = [];
		this.attributes = {};
	}

	public static isElement(node: Node): node is Element {
		return node.type === NodeTypes.Element;
	}
}

export default class Parser {
	private last: Element;

	private attributeName: string;

	public root: Element;

	public constructor() {
		this.reset();
	}

	private reset(): void {
		delete this.root;
	}

	private handle(token: Token): Node | undefined {
		switch(token.type) {
			case TokenTypes.OpeningTag:
				if(this.attributeName != undefined) {
					throw new ParseError("expected attribute value", token.cursor, undefined, serializer.serializeToken(token));
				}

				const element = new Element(token.value);

				if(this.root == undefined) {
					this.root = element;
				} else {
					if(this.last == undefined) {
						throw new ParseError("unexpected non-whitespace after document end", token.cursor, undefined, serializer.serializeToken(token));
					}

					element.parent = this.last;
					this.last.children.push(element);
				}

				this.last = element;

				return element;

				break;

			case TokenTypes.ClosingTag:
				if(this.last == undefined) {
					throw new ParseError("unexpected non-whitespace after document end", token.cursor, undefined, serializer.serializeToken(token));
				}

				if(this.last.name !== token.value) {
					throw new ParseError("closing tag does not match opening tag", token.cursor, this.last.name, token.value);
				}

				this.last = this.last.parent;

				break;

			case TokenTypes.AttributeName:
				if(this.attributeName != undefined) {
					throw new ParseError("expected attribute value", token.cursor, undefined, serializer.serializeToken(token));
				}

				this.attributeName = token.value;
				this.last.attributes[this.attributeName] = undefined;

				break;

			case TokenTypes.AttributeValue:
				this.last.attributes[this.attributeName] = token.value;
				delete this.attributeName;

				break;

			case TokenTypes.Text:
				if(this.attributeName != undefined) {
					throw new ParseError("expected attribute value", token.cursor, undefined, serializer.serializeToken(token));
				}

				const text = new Text(token.value);
				text.parent = this.last;
				this.last.children.push(text);

				return text;

				break;
		}
	}

	public write(token: Token[]): Node[] {
		return token.map(t => this.handle(t)).filter<Node>((node): node is Node => node != undefined);
	}

	public end(token?: Token[]): Element {
		if(token != undefined) {
			this.write(token);
		}

		if(this.last != undefined) {
			throw new ParseError("document incomplete");
		}

		const root = this.root;

		this.reset();

		return root;
	}
}
