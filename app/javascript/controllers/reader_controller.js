import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tray", "preview", "chapterTray"]
  static values = {
    focus: Number,
    chapterSlug: String,
    notesUrl: String
  }

  connect() {
    if (this.focusValue) {
      const el = this.element.querySelector(`#v${this.focusValue}`)
      el?.scrollIntoView({ block: "center" })
    }
  }

  openVerse(event) {
    const verse = event.currentTarget.closest("[data-verse]")
    if (!verse) return
    const wasOpen = verse.classList.contains("is-open")
    this.element.querySelectorAll(".verse.is-open").forEach((v) => {
      v.classList.remove("is-open")
      this.setTraysHidden(v, true)
    })
    if (wasOpen) return
    verse.classList.add("is-open")
    const trays = this.traysIn(verse)
    trays.forEach((tray) => { tray.hidden = false })
    trays[0]?.querySelector("textarea")?.focus()
  }

  toggleChapter() {
    if (!this.hasChapterTrayTarget) return
    this.chapterTrayTarget.hidden = !this.chapterTrayTarget.hidden
    if (!this.chapterTrayTarget.hidden) {
      this.chapterTrayTarget.querySelector("textarea")?.focus()
    }
  }

  toggleExpand() {
    const expanding = !this.element.classList.contains("is-expanded")
    this.element.classList.toggle("is-expanded", expanding)
    this.element.querySelectorAll(".verse.has-note").forEach((v) => {
      const open = v.classList.contains("is-open")
      v.querySelectorAll(".note-preview").forEach((preview) => {
        preview.hidden = !expanding || open
      })
      this.setTraysHidden(v, expanding || !open)
    })
  }

  async share(event) {
    const url = event.params.routeBible || window.location.href
    try {
      await navigator.clipboard.writeText(url)
      event.currentTarget.title = "Copied"
    } catch {
      window.prompt("Copy route.bible link", url)
    }
  }

  autosave(event) {
    const area = event.currentTarget
    clearTimeout(area._kvTimer)
    area._kvTimer = setTimeout(() => this.save(area), 450)
  }

  async save(area) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content
    const body = new URLSearchParams({ slug: area.dataset.slug, text: area.value })
    const res = await fetch(this.notesUrlValue, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "X-CSRF-Token": token,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    })
    if (!res.ok) return
    await res.json()
    const verse = area.closest(".verse")
    if (!verse) return
    verse.classList.toggle("has-note", this.anyNoteText(verse))
  }

  traysIn(verse) {
    return verse.querySelectorAll(".note-tray")
  }

  setTraysHidden(verse, hidden) {
    this.traysIn(verse).forEach((tray) => { tray.hidden = hidden })
  }

  anyNoteText(verse) {
    return [...verse.querySelectorAll("textarea")].some((area) => area.value.trim().length > 0)
  }
}
