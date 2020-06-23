import Lexer from './lexer';
import Parser from './parser';
import Serializer from './serializer';

const xml =
`<document>
	<level name="test-level">put data here</level>
</document>`;

const lexer = new Lexer();
const parser = new Parser();
const serializer = new Serializer();

for(let i = 0; i < xml.length; i += 4) {
	const chunk = xml.substr(i, 4);
	const token = lexer.write(chunk);
	console.log(token);
	parser.write(token);
}

console.log('---');

lexer.end();
const document = parser.end();

console.log(document);

console.log('---');

console.log(serializer.serialize(document));

console.log('---');
