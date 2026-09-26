# Containers and CI

Run all Docker commands from the repository root. Both images use Node 24.21.0 and npm 12.1.0,
matching package.json; update their defaults and CI pins together when upgrading tooling.
The root .dockerignore excludes dependencies, local environment files, credentials and reports.

## Application

```sh
docker build -t boilerplate-frontend:local .
docker run --rm --publish 8080:8080 boilerplate-frontend:local
```

The build stage runs Vite; the runtime contains dist and Nginx, runs as nginx and listens on 8080.
`/healthz` is the container health endpoint. Client routes fall back to index.html, which is not cached;
hashed assets have immutable caching and missing assets return 404. Environment values used by Vite
are compiled into the bundle; setting container runtime variables does not rewrite it.

## Autotests

```sh
docker build -f autotests/Dockerfile -t boilerplate-autotests:local .
docker run --rm --init --shm-size=1g boilerplate-autotests:local
```

This image installs both locked npm projects and the Chromium version selected by the locked
Playwright package. It runs as node and starts the root Vite server through playwright.config.ts.
It needs no separately running application container or external backend; current tests use mocks.
Run the complete browser-package verification with:

```sh
docker run --init --shm-size=1g --name boilerplate-browser-checks \
  boilerplate-autotests:local sh -c 'npm run lint && npm test && npm run test:guard'
mkdir -p autotests/playwright/playwright-report
docker cp boilerplate-browser-checks:/app/autotests/playwright/playwright-report/. autotests/playwright/playwright-report/
docker rm boilerplate-browser-checks
```

The five deliberately failing mock scenarios are verified by test:guard; success means the guard
detected each failure. Preserve the stopped container until reports are copied when diagnosing failures.

## Main-repository pipelines

GitLab reads `.gitlab-ci.yml`, which includes `autotests/.gitlab-ci.yml`. Autotests are a required job
in the main pipeline, not a separate repository. Root jobs lint, test tooling/application code, check
docs/graphs/codegen freshness and publish dist as a CI artifact. The browser job runs its own lint,
Chromium cases and negative mock checks, retaining HTML, traces and JUnit reports even on failure.
Both Dockerfiles are built by rootless BuildKit jobs. Their OCI outputs are temporary build checks;
images are not uploaded to a registry. A Docker or Kubernetes Linux runner must permit rootless
BuildKit user namespaces and required mount operations; see the
[GitLab runner requirements](https://docs.gitlab.com/ci/docker/using_buildkit/).

GitHub reads `.github/workflows/ci.yml`; its required autotests job calls
`.github/workflows/autotests.yml`. GitHub discovers workflows only in the root workflow directory,
so the reusable browser workflow lives there while its Dockerfile/package live under autotests.
The browser job builds and executes the autotest image, then uploads its reports. The frontend job
also smoke-tests its Nginx image. Workflows use GitHub-hosted Ubuntu runners, read-only repository
permissions and pinned action commits. See the official
[Node workflow guide](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).

Pushes and merge/pull requests trigger the main pipelines; browser failures fail the overall run.
Configure branch protection/merge checks in the hosting service to require those statuses.
Neither pipeline publishes images or deploys; a registry and deployment target have not been selected.
GitLab runs browser tests natively in its Node job; GitHub runs them inside the built image.
GitLab avoids duplicate branch pipelines for branches with open merge requests.

Browser container setup follows [Playwright's Docker guidance](https://playwright.dev/docs/docker).
