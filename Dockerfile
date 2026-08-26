# syntax=docker/dockerfile:1
# Railway production image. The HTTP server must listen on PORT (default 80).

ARG RUBY_VERSION=3.4.10
FROM node:22-bookworm-slim AS node

FROM ruby:${RUBY_VERSION}-slim-bookworm AS base

WORKDIR /rails

ENV RAILS_ENV=production \
    RAILS_LOG_TO_STDOUT=1 \
    RAILS_SERVE_STATIC_FILES=1 \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT=development:test \
    PORT=80

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      ca-certificates \
      libpq5 \
      libsqlite3-0 \
      libvips42 \
      libyaml-0-2 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

FROM base AS build

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      build-essential \
      curl \
      git \
      libpq-dev \
      libsqlite3-dev \
      libyaml-dev \
      pkg-config && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY Gemfile Gemfile.lock ./
RUN bundle config set without "development test" && \
    bundle install && \
    rm -rf ~/.bundle "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Scripture is the vendored BSB USJ under vendor/scripture/bsb/usj
# (never fetched at runtime). Seed sqlite
# for a warm preview; the reader hydrates a chapter from USJ when needed.
RUN npm run build && \
    SECRET_KEY_BASE_DUMMY=1 bundle exec rails assets:precompile && \
    SECRET_KEY_BASE_DUMMY=1 bundle exec rails db:prepare && \
    SECRET_KEY_BASE_DUMMY=1 bundle exec rails margin:seed_scripture && \
    rm -rf node_modules tmp/cache && \
    chmod +x bin/docker-start

FROM base

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

EXPOSE 80
CMD ["/rails/bin/docker-start"]
