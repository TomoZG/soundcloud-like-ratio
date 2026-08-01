# Public Repository Settings

These controls should remain configured for the public repository:

- Require GitHub Actions to use full-length commit SHAs.
- Enable Dependabot alerts and security updates.
- Enable CodeQL default setup for JavaScript.
- Enable secret scanning and push protection.
- Enable private vulnerability reporting.
- Enable immutable releases.
- Automatically delete head branches after pull requests are merged.
- Add a tag ruleset for `v*` that restricts tag creation, update, and deletion
  to repository administrators.
- Protect `master` and require the Node 22.x, Node 24.x, and Dependency review
  checks before merging.
- Keep Discussions disabled and Issues enabled.
- Create the labels `bug`, `enhancement`, `documentation`, `dependencies`, and
  `skip-changelog` used by templates and generated release notes.

Release workflows must create a draft, attach every asset, and only then publish
the release. Publication locks future releases when immutability is enabled.
