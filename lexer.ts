class LexError extends SyntaxError {
	public constructor(message: string, cursor: Cursor) {
		super(`${ message } at ${ cursor }.`);
		this.name = 'LexError';
	}
}

export class Cursor {
	public position: number;
	public line: number;
	public column: number;

	public constructor(position: number, line: number, column: number) {
		this.position = position;
		this.line = line;
		this.column = column;
	}

	public toString(): string {
		return `line: ${ this.line }, column: ${ this.column }`;
	}
}

export class Token {
	public type: TokenTypes;
	public value: string;

	public cursor: Cursor;

	public constructor(type: TokenTypes, value: string, cursor: Cursor) {
		this.type = type;
		this.value = value;
		this.cursor = cursor;
	}
}

const noop = () => {};

// new state: OpeningTagAddidtions for spaces between Attributes

enum States {
	Data,
	CData,
	TagBegin,
	TagName,
	TagEnd,
	AttributeNameStart,
	AttributeName,
	AttributeNameEnd,
	AttributeValueBegin,
	AttributeValue
}

enum Actions {
	LessThan,
	GreaterThan,
	Space,
	Equal,
	Quote,
	Slash,
	Char,
	Error
}

export enum TokenTypes {
	Text = 'text',
	OpeningTag = 'opening-tag',
	ClosingTag = 'closing-tag',
	AttributeName = 'attribute-name',
	AttributeValue = 'attribute-value'
}

const actionMap: { [key: string]: Actions } = {
    ' ': Actions.Space,
    '\t': Actions.Space,
    '\n': Actions.Space,
    '\r': Actions.Space,
    '<': Actions.LessThan,
    '>': Actions.GreaterThan,
    '"': Actions.Quote,
    "'": Actions.Quote,
    '=': Actions.Equal,
    '/': Actions.Slash,
};

const getAction = (char: string): Actions => actionMap[char] != undefined ? actionMap[char] : Actions.Char;

type Processor = (char?: string) => Token | void;
type StateActions = { [action: number]: Processor };
type StateMachine = { [state in States]: StateActions };

export default class Lexer {
	private state: States;

	private tag: string;
	private value: string;
	private isClosingTag: boolean;
	private openingQuote: string;

	public stateMachine: StateMachine;

	public cursor: Cursor;

	public constructor() {
		this.reset();

		this.stateMachine = {
			[States.Data]: {
				[Actions.LessThan]: () => {
					this.isClosingTag = false;
					this.state = States.TagBegin;

					let token;

					if(this.value.trim()) {
						token = new Token(TokenTypes.Text, this.value, this.cursor);
					}

					this.value = '';
					return token;
				},
				[Actions.Char]: (char: string) => {
					this.value += char;
				}
			},
			[States.CData]: {
				[Actions.Char]: (char: string) => {
					this.value += char;
					if(this.value.substr(-3) === ']]>') {
						const token = new Token(TokenTypes.Text, this.value.slice(0, -3), this.cursor);

						this.value = '';
						this.state = States.Data;
						return token;
					}
				}
			},
			[States.TagBegin]: {
				[Actions.Space]: noop,
				[Actions.Char]: (char: string) => {
					this.tag = char;
					this.state = States.TagName;
				},
				[Actions.Slash]: () => {
					this.isClosingTag = true;
				},
				[Actions.Error]: () => {
					throw new LexError("TagBegin: expected '/' or tag name", this.cursor);
				}
			},
			[States.TagName]: {
				[Actions.Space]: () => {
					if(this.isClosingTag) {
						this.state = States.TagEnd;
					} else {
						const token = new Token(TokenTypes.OpeningTag, this.tag, this.cursor);

						this.state = States.AttributeNameStart;

						return token;
					}
				},
				[Actions.GreaterThan]: () => {
					let token;
					if(this.isClosingTag) {
						token = new Token(TokenTypes.ClosingTag, this.tag, this.cursor);
						this.tag = '';
					} else {
						token = new Token(TokenTypes.OpeningTag, this.tag, this.cursor);
					}

					this.state = States.Data;

					return token;
				},
				[Actions.Slash]: () => {
					const token = new Token(TokenTypes.OpeningTag, this.tag, this.cursor);

					this.state = States.TagEnd;

					return token;
				},
				[Actions.Char]: (char: string) => {
					this.tag += char;
					if(this.tag === '![CDATA[') {
						this.tag = '';
						this.state = States.CData;
					}
				},
				[Actions.Error]: () => {
					throw new LexError("TagName: markup characters must be escaped", this.cursor);
				}
			},
			[States.TagEnd]: {
				[Actions.GreaterThan]: () => {
					const token = new Token(TokenTypes.ClosingTag, this.tag, this.cursor);

					this.tag = '';
					this.state = States.Data;

					return token;
				},
				[Actions.Error]: () => {
					throw new LexError("TagEnd: expected '>' to close the tag", this.cursor);
				}
			},
			[States.AttributeNameStart]: {
				[Actions.Char]: (char: string) => {
					this.value = char;
					this.state = States.AttributeName;
				},
				[Actions.GreaterThan]: () => {
					this.value = '';
					this.state = States.Data;
				},
				[Actions.Space]: noop,
				[Actions.Slash]: () => {
					this.isClosingTag = true;
					this.state = States.TagEnd;
				},
			},
			[States.AttributeName]: {
				[Actions.Space]: () => {
					this.state = States.AttributeNameEnd;
				},
				[Actions.Equal]: () => {
					const token = new Token(TokenTypes.AttributeName, this.value, this.cursor);

					this.value = '';
					this.state = States.AttributeValueBegin;

					return token;
				},
				[Actions.GreaterThan]: () => {
					const token = new Token(TokenTypes.AttributeName, this.value, this.cursor);

					this.value = '';
					this.state = States.Data;

					return token;
				},
				[Actions.Slash]: () => {
					const token = new Token(TokenTypes.AttributeName, this.value, this.cursor);

					this.isClosingTag = true;
					this.value = '';
					this.state = States.TagEnd;

					return token;
				},
				[Actions.Char]: (char: string) => {
					this.value += char;
				},
			},
			[States.AttributeNameEnd]: {
				[Actions.Space]: noop,
				[Actions.Equal]: () => {
					const token = new Token(TokenTypes.AttributeName, this.value, this.cursor);

					this.value = '';
					this.state = States.AttributeValueBegin;

					return token;
				},
				[Actions.GreaterThan]: () => {
					const token = new Token(TokenTypes.AttributeName, this.value, this.cursor);

					this.value = '';
					this.state = States.Data;

					return token;
				},
				[Actions.Slash]: () => {
					const token = new Token(TokenTypes.AttributeName, this.value, this.cursor);

					this.isClosingTag = true;
					this.value = '';
					this.state = States.TagEnd;

					return token;
				},
				[Actions.Char]: (char: string) => {
					const token = new Token(TokenTypes.AttributeName, this.value, this.cursor);

					this.value = char;
					this.state = States.AttributeName;

					return token;
				},
			},
			[States.AttributeValueBegin]: {
				[Actions.Space]: noop,
				[Actions.Quote]: (char: string) => {
					this.openingQuote = char;
					this.value = '';
					this.state = States.AttributeValue;
				},
				// not valid xml
				[Actions.GreaterThan]: () => {
					this.state = States.Data;

					//throw new TokenizationError("attribute value must be quoted", this.cursor);
				},
				[Actions.Char]: (char: string) => {
					this.openingQuote = '';
					this.value = char;
					this.state = States.AttributeValue;

					//throw new TokenizationError("attribute value must be quoted", this.cursor);
				},
			},
			[States.AttributeValue]: {
				[Actions.Space]: (char: string) => {
					if(this.openingQuote) {
						this.value += char;
					} else {
						const token = new Token(TokenTypes.AttributeValue, this.value, this.cursor);

						this.value = '';
						this.state = States.AttributeNameStart;

						return token;
					}
				},
				[Actions.Quote]: (char: string) => {
					if(this.openingQuote === char) {
						const token = new Token(TokenTypes.AttributeValue, this.value, this.cursor);

						this.value = '';
						this.state = States.AttributeNameStart;

						return token;
					} else {
						this.value += char;
					}
				},
				[Actions.GreaterThan]: (char: string) => {
					if(this.openingQuote) {
						this.value += char;
					} else {
						const token = new Token(TokenTypes.AttributeValue, this.value, this.cursor);

						this.value = '';
						this.state = States.Data;
						return token;
					}
				},
				[Actions.Slash]: (char: string) => {
					if(this.openingQuote) {
						this.value += char;
					} else {
						const token = new Token(TokenTypes.AttributeValue, this.value, this.cursor);

						this.isClosingTag = true;
						this.value = '';
						this.state = States.TagEnd;

						return token;
					}
				},
				[Actions.Char]: (char: string) => {
					this.value += char;
				},
			},
	 	};
	}

	private reset(): void {
		this.state = States.Data;

		this.tag = '';
		this.value = '';
		this.openingQuote = '';
		this.isClosingTag = false;

		this.cursor = new Cursor(0, 0, 0);
	}

	private step(char: string): Token | void {
		this.cursor.position++;
		
		if(char === '\n') {
			this.cursor.line++;
			this.cursor.column = 0;
		}

		if(char === '\t') {
			// what to do here?
			this.cursor.column++;
		} else {
			this.cursor.column++;
		}

		const actions = this.stateMachine[this.state];
		const action = actions[getAction(char)] || actions[Actions.Error] || actions[Actions.Char];

		return action(char);
	}

	public write(chunk: string): Token[] {
		const res: Token[] = [];

		for(let i = 0; i < chunk.length; i++) {
			const token = this.step(chunk[i]);
			if(token != undefined) {
				res.push(token as Token);
			}
		}

		return res;
	}

	public end(chunk?: string): Token[] {
		let res: Token[] = [];

		if(chunk != undefined) {
			res = this.write(chunk);
		} else {
			res = [];
		}

		this.reset();

		return res;
	}
}
