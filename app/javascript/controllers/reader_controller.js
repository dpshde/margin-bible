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
    const tray = verse.querySelector(".note-tray")
    const wasOpen = verse.classList.contains("is-open")
    this.element.querySelectorAll(".verse.is-open").forEach((v) => {
      v.classList.remove("is-open")
      const t = v.querySelector(".note-tray")
      if (t) t.hidden = true
    })
    if (wasOpen) return
    verse.classList.add("is-open")
    if (tray) {
      tray.hidden = false
      tray.querySelector("textarea")?.focus()
    }
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
      const preview = v.querySelector(".note-preview")
      const tray = v.querySelector(".note-tray")
      if (preview) preview.hidden = !expanding || v.classList.contains("is-open")
      if (tray && expanding) tray.hidden = true
      if (!expanding && !v.classList.contains("is-open") && tray) tray.hidden = true
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
    const json = await res.json()
    const verse = area.closest(".verse")
    if (!verse) return
    verse.classList.toggle("has-note", !json.deleted && area.value.trim().length > 0)
  }
}
