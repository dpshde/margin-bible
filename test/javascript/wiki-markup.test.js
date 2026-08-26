import assert from "node:assert/strict"
import { resolveWikiTarget, wikiRaw, wikiTokens } from "../../app/javascript/lib/wiki-markup.js"

{
  const resolved = resolveWikiTarget("John 3:16")
  assert.equal(resolved.slug, "jhn.3.16")
  assert.equal(resolved.href, "/jhn.3.16")
  assert.equal(resolved.label, "John 3:16")
}

{
  const resolved = resolveWikiTarget("jhn.1.6")
  assert.equal(resolved.slug, "jhn.1.6")
  assert.equal(resolved.label, "John 1:6")
}

{
  assert.equal(resolveWikiTarget("not a verse"), null)
}

{
  const tokens = wikiTokens("See [[jhn.1.6|the Baptist]] and [[John 1]] end")
  assert.equal(tokens[0].value, "See ")
  assert.equal(tokens[1].type, "wiki")
  assert.equal(tokens[1].href, "/jhn.1.6")
  assert.equal(tokens[1].label, "the Baptist")
  assert.equal(tokens[1].raw, "[[jhn.1.6|the Baptist]]")
  assert.equal(tokens[2].value, " and ")
  assert.equal(tokens[3].slug, "jhn.1")
  assert.equal(tokens[3].label, "John 1")
  assert.equal(tokens[4].value, " end")
}

{
  assert.equal(wikiRaw("jhn.1.6", "John"), "[[jhn.1.6|John]]")
  assert.equal(wikiRaw("jhn.1"), "[[jhn.1]]")
}
