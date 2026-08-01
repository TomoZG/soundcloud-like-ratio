# Public Repository Settings

These controls are configured through GitHub after the privacy-safe history is
pushed and before the repository is made public:

- Require GitHub Actions to use full-length commit SHAs.
- Enable Dependabot alerts and security updates.
- Enable CodeQL default setup for JavaScript.
- Enable secret scanning and push protection.
- Enable private vulnerability reporting.
- Add a tag ruleset for `v*` that restricts tag creation, update, and deletion
  to repository administrators.
- Protect `master` and require the Node 22.x and 24.x CI checks before merging.
- Keep Discussions disabled and Issues enabled.
- Create the labels `bug`, `enhancement`, `documentation`, `dependencies`, and
  `skip-changelog` used by templates and generated release notes.

Do not create the `v1.0.0` tag until the repository is public; public artifact
attestations then use GitHub's public Sigstore service.
