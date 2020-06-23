import { Element, Text, Node } from './parser';

export default class Serializer {
	public serialize(node: Node, depth: number = 0): string {
		if(Element.isElement(node)) {
			return `${ depth ? `\n` : `` }${ Array(depth + 1).join('\t') }<${ node.name }${ Object.keys(node.attributes).map(n => ` ${ n }="${ node.attributes[n] != undefined ? node.attributes[n] : `` }"`).join('') }>${ node.children.map(c => this.serialize(c, depth + 1)).join('') }</${ node.name }>${ Array(depth + 1).join('\t') }${ depth ? `\n` : `` }`;
		} else {
			return (<Text>node).value;
		}
	}
}
