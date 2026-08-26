# frozen_string_literal: true

class ResolvesController < ApplicationController
  def show
    q = params[:q].presence || params[:osis].presence || params[:ref].presence
    passage = inbound_passage
    respond_to do |format|
      format.html do
        if passage
          redirect_to read_path(passage.slug)
        else
          redirect_to read_path("jhn.1"), alert: "Couldn’t resolve #{q.to_s.inspect}."
        end
      end
      format.json do
        if passage
          render json: {
            ok: true,
            q: q,
            slug: passage.slug,
            chapter_slug: passage.chapter_slug,
            label: passage.label,
            kind: passage.kind,
            route_bible: Margin::RouteBible.url_for(passage)
          }
        else
          render json: { ok: false, q: q }, status: :unprocessable_entity
        end
      end
    end
  end
end
