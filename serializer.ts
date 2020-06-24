import { Element, Text, Node } from './parser';
import { Token, TokenTypes } from './lexer';

export default class Serializer {
	public constructor() {

	}

	public serialize(node: Node, depth: number = 0): string {
		if(Element.isElement(node)) {
			return `${ depth ? `\n` : `` }${ Array(depth + 1).join('\t') }<${ node.name }${ Object.keys(node.attributes).map(n => ` ${ n }="${ node.attributes[n] != undefined ? node.attributes[n] : `` }"`).join('') }>${ node.children.map(c => this.serialize(c, depth + 1)).join('') }</${ node.name }>${ Array(depth + 1).join('\t') }${ depth ? `\n` : `` }`;
		} else {
			return (<Text>node).value;
		}
	}

	public serializeElement(el: Element): string {
		return `<${ el.name }${ Object.keys(el.attributes).map(n => ` ${ n }="${ el.attributes[n] != undefined ? el.attributes[n] : `` }"`).join('') }/>`
	}

	public serializeToken(token: Token): string {
		switch(token.type) {
			case TokenTypes.OpeningTag:
				return this.serializeOpeningTagToken(token);

			case TokenTypes.ClosingTag:
				return this.serializeClosingTagToken(token);

			case TokenTypes.AttributeName:
				return this.serializeAttributeNameToken(token);

			case TokenTypes.AttributeValue:
				return this.serializeAttributeValueToken(token);

			case TokenTypes.Text:
				return this.serializeTextToken(token);
		}
	}

	private serializeOpeningTagToken(token: Token): string {
		return `<${ token.value }>`;
	}

	private serializeClosingTagToken(token: Token): string {
		return `</${ token.value }>`;
	}

	private serializeTextToken(token: Token): string {
		return token.value;
	}

	private serializeAttributeNameToken(token: Token): string {
		return token.value;
	}

	private serializeAttributeValueToken(token: Token): string {
		return `"${ token.value }"`;
	}
}
