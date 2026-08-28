import assert from "node:assert/strict"
import { displayTokens, inlineMdTokens, resolveWikiTarget, wikiRaw, wikiTokens } from "../../app/javascript/lib/wiki-markup.js"

{
  const resolved = resolveWikiTarget("John 3:16")
  assert.equal(resolved.slug, "jhn.3.16")
  assert.equal(resolved.href, "/jhn.3.16?xref=1")
  assert.equal(resolved.label, "John 3:16")
}

{
  const resolved = resolveWikiTarget("jhn.1.6")
  assert.equal(resolved.slug, "jhn.1.6")
  assert.equal(resolved.href, "/jhn.1.6?xref=1")
  assert.equal(resolved.label, "John 1:6")
}

{
  assert.equal(resolveWikiTarget("not a verse"), null)
}

{
  const tokens = wikiTokens("See [[jhn.1.6|the Baptist]] and [[John 1]] end")
  assert.equal(tokens[0].value, "See ")
  assert.equal(tokens[1].type, "wiki")
  assert.equal(tokens[1].href, "/jhn.1.6?xref=1")
  assert.equal(tokens[1].label, "the Baptist")
  assert.equal(tokens[1].raw, "[[jhn.1.6|the Baptist]]")
  assert.equal(tokens[2].value, " and ")
  assert.equal(tokens[3].slug, "jhn.1")
  assert.equal(tokens[3].href, "/jhn.1")
  assert.equal(tokens[3].label, "John 1")
  assert.equal(tokens[4].value, " end")
}

{
  assert.equal(wikiRaw("jhn.1.6", "John"), "[[jhn.1.6|John]]")
  assert.equal(wikiRaw("jhn.1"), "[[jhn.1]]")
}

{
  const tokens = inlineMdTokens("See **Word** and *life* and _light_")
  assert.equal(tokens[0].value, "See ")
  assert.deepEqual(tokens[1], { type: "strong", value: "Word" })
  assert.equal(tokens[2].value, " and ")
  assert.deepEqual(tokens[3], { type: "em", value: "life" })
  assert.equal(tokens[4].value, " and ")
  assert.deepEqual(tokens[5], { type: "em", value: "light" })
}

{
  const tokens = displayTokens("See **Word** and [[jhn.1.6|John]]")
  assert.deepEqual(tokens[1], { type: "strong", value: "Word" })
  assert.equal(tokens[3].type, "wiki")
  assert.equal(tokens[3].href, "/jhn.1.6?xref=1")
}

{
  const tokens = wikiTokens("See John 3:16 and Romans 8:28 end")
  assert.equal(tokens[0].value, "See ")
  assert.equal(tokens[1].type, "wiki")
  assert.equal(tokens[1].raw, "John 3:16")
  assert.equal(tokens[1].href, "/jhn.3.16?xref=1")
  assert.equal(tokens[1].label, "John 3:16")
  assert.equal(tokens[2].value, " and ")
  assert.equal(tokens[3].slug, "rom.8.28")
  assert.equal(tokens[3].href, "/rom.8.28?xref=1")
  assert.equal(tokens[4].value, " end")
}

{
  const tokens = wikiTokens("See [[jhn.1.6|the Baptist]] and John 1:1")
  assert.equal(tokens[1].raw, "[[jhn.1.6|the Baptist]]")
  assert.equal(tokens[3].raw, "John 1:1")
  assert.equal(tokens[3].href, "/jhn.1.1?xref=1")
}

{
  const tokens = wikiTokens("Cf. jhn.1.6 and John 3:16–18")
  assert.equal(tokens[1].slug, "jhn.1.6")
  assert.equal(tokens[3].slug, "jhn.3.16-18")
  assert.equal(tokens[3].raw, "John 3:16–18")
}

{
  const tokens = wikiTokens("See **John** and `John 3:16` here")
  assert.equal(tokens.some((token) => token.type === "wiki"), false)
}

{
  const tokens = displayTokens("See John 3:16 and **Word**")
  assert.equal(tokens[1].type, "wiki")
  assert.equal(tokens[1].href, "/jhn.3.16?xref=1")
  assert.deepEqual(tokens[3], { type: "strong", value: "Word" })
}
