import { CSV_BOM, guardFormula, numeric, toCsv } from './csv';

describe('toCsv (T-043, RFC 4180)', () => {
  it('starts with a UTF-8 byte-order mark and ends every record with CRLF', () => {
    const csv = toCsv([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}a,b\r\nc,d\r\n`);
  });

  it('quotes fields containing a comma, a quote, CR or LF and doubles the quotes', () => {
    const csv = toCsv([['plain', 'a,b', 'say "hi"', 'line1\nline2', 'cr\rhere', 'crlf\r\nx']]);
    expect(csv).toBe(
      `${CSV_BOM}plain,"a,b","say ""hi""","line1\nline2","cr\rhere","crlf\r\nx"\r\n`,
    );
  });

  it('writes an empty field for null and an empty string', () => {
    expect(toCsv([['a', null, '', 'b']])).toBe(`${CSV_BOM}a,,,b\r\n`);
  });

  it('keeps Vietnamese and other non-ASCII text as is', () => {
    expect(toCsv([['Hãng xe', 'Đang xem xét']])).toBe(`${CSV_BOM}Hãng xe,Đang xem xét\r\n`);
  });

  it('writes the header only for no rows', () => {
    expect(toCsv([['Stock no.', 'VIN']])).toBe(`${CSV_BOM}Stock no.,VIN\r\n`);
  });
});

describe('formula-injection guard (AC-013.4, NFR-03)', () => {
  it.each([
    ['=SUM(A1)', "'=SUM(A1)"],
    ['+44 1234', "'+44 1234"],
    ['-2+3', "'-2+3"],
    ['@x', "'@x"],
    ['\tcmd', "'\tcmd"],
  ])('prefixes the text %j with an apostrophe', (value, expected) => {
    expect(guardFormula(value)).toBe(expected);
  });

  it('leaves other text untouched, including a formula character later in the text', () => {
    expect(guardFormula('Ford')).toBe('Ford');
    expect(guardFormula('a=b')).toBe('a=b');
    expect(guardFormula(' =x')).toBe(' =x');
    expect(guardFormula('')).toBe('');
  });

  it('guards a note-like and a name-like text cell in the CSV', () => {
    expect(toCsv([['=SUM(A1)', '@x']])).toBe(`${CSV_BOM}'=SUM(A1),'@x\r\n`);
  });

  it('guards a leading CR and still quotes the field', () => {
    expect(toCsv([['\r=1']])).toBe(`${CSV_BOM}"'\r=1"\r\n`);
  });

  it('guards and quotes a formula that also contains a comma and quotes', () => {
    expect(toCsv([['=HYPERLINK("http://x","y")']])).toBe(
      `${CSV_BOM}"'=HYPERLINK(""http://x"",""y"")"\r\n`,
    );
  });

  it('writes numeric cells unguarded and unquoted', () => {
    expect(toCsv([[25990, numeric('25990.00'), 0, numeric('-1')]])).toBe(
      `${CSV_BOM}25990,25990.00,0,-1\r\n`,
    );
  });
});

describe('numeric', () => {
  it.each(['1', '0', '25990.50', '-3', '1.5'])('accepts the decimal %j', (value) => {
    expect(numeric(value)).toEqual({ numeric: value });
  });

  it.each(['', '1e3', '=1', '1,5', ' 1', 'NaN', '.5'])('rejects %j', (value) => {
    expect(() => numeric(value)).toThrow(RangeError);
  });

  it('rejects a non-finite number cell', () => {
    expect(() => toCsv([[Number.NaN]])).toThrow(RangeError);
  });
});
