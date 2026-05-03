import { describe, expect, test } from 'bun:test';
import { highlight } from '@/lib/helpers/highlight';

describe('highlight — primitives', () => {
  test('null', () => {
    expect(highlight(null)).toBe('<span class="jnull">null</span>');
  });

  test('true', () => {
    expect(highlight(true)).toBe('<span class="jb">true</span>');
  });

  test('false', () => {
    expect(highlight(false)).toBe('<span class="jb">false</span>');
  });

  test('number', () => {
    expect(highlight(42)).toBe('<span class="jn">42</span>');
  });

  test('zero', () => {
    expect(highlight(0)).toBe('<span class="jn">0</span>');
  });

  test('string', () => {
    expect(highlight('hello')).toBe('<span class="js">"hello"</span>');
  });

  test('empty string', () => {
    expect(highlight('')).toBe('<span class="js">""</span>');
  });
});

describe('highlight — HTML escaping', () => {
  test('escapes & in string value', () => {
    expect(highlight('a&b')).toBe('<span class="js">"a&amp;b"</span>');
  });

  test('escapes < in string value', () => {
    expect(highlight('<div>')).toBe('<span class="js">"&lt;div&gt;"</span>');
  });

  test('escapes & in object key', () => {
    const result = highlight({ 'a&b': 1 });
    expect(result).toContain('<span class="jk">"a&amp;b"</span>');
  });
});

describe('highlight — arrays', () => {
  test('empty array', () => {
    expect(highlight([])).toBe('<span class="jp">[]</span>');
  });

  test('single-item array contains value', () => {
    const result = highlight([1]);
    expect(result).toContain('<span class="jn">1</span>');
    expect(result).toContain('<span class="jp">[</span>');
    expect(result).toContain('<span class="jp">]</span>');
  });

  test('multi-item array includes comma separator', () => {
    const result = highlight([1, 2]);
    expect(result).toContain('<span class="jp">,</span>');
  });

  test('nested array indents correctly', () => {
    const result = highlight([[1]]);
    // outer indent=0, inner indent=1 → pad1 for outer item = '  '
    expect(result).toContain('  <span class="jp">[</span>');
  });
});

describe('highlight — objects', () => {
  test('empty object', () => {
    expect(highlight({})).toBe('<span class="jp">{}</span>');
  });

  test('object key is wrapped in jk span', () => {
    const result = highlight({ name: 'alice' });
    expect(result).toContain('<span class="jk">"name"</span>');
  });

  test('object value is rendered with correct type', () => {
    const result = highlight({ count: 3 });
    expect(result).toContain('<span class="jn">3</span>');
  });

  test('multiple keys include comma separator', () => {
    const result = highlight({ a: 1, b: 2 });
    expect(result).toContain('<span class="jp">,</span>');
  });

  test('nested object increases indentation', () => {
    const result = highlight({ outer: { inner: true } });
    // inner key should be indented at level 1 (4 spaces)
    expect(result).toContain('    <span class="jk">"inner"</span>');
  });

  test('null value inside object', () => {
    const result = highlight({ x: null });
    expect(result).toContain('<span class="jnull">null</span>');
  });
});

describe('highlight — unknown/fallback', () => {
  test('undefined falls through to esc(String(val))', () => {
    expect(highlight(undefined)).toBe('undefined');
  });
});
