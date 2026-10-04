# OriginMetric public HTTPS observation

This repository runs two public GET checks from a standard GitHub-hosted Ubuntu runner:
`https://originmetric.app/api/health` and `https://originmetric.app/js/v1/om.js`.
No application writes, credentials, private repository access or backup objects are used.
HTTP 200 and appropriate bounded response content are required; failure fails the workflow.

Open the repository **Actions** tab on a phone for timestamps, PASS/FAIL and endpoint results.
A result older than 15 minutes is stale/unknown. A successful run is one availability sample.
The schedule runs approximately every five minutes (`2-57/5 * * * *`, UTC); it was enabled
after the initial manual check passed. Jobs can be delayed or dropped; public schedules
may be disabled after 60 days without repository activity. Check Actions weekly and confirm
that the workflow remains enabled and fresh. No synthetic commit is made to hide inactivity.

Actions history is not verified email delivery or an independent dead-man alarm. Failure,
missing-run detection and notification destination/delivery are separate operational work.
See [GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
Standard hosted runners on public repositories are [free](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
No larger runner, artifact storage, npm dependency or paid service is configured.


For native Actions email notifications, open GitHub **Settings → Notifications →
System → Actions**, select **Email**, and save. Optionally choose failed workflows
only. See [GitHub Actions notification settings](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications).
The workflow has no dedicated email-send step. A failed control run does not prove
email delivery: record actual receipt separately. Account notification settings
and workflow-trigger eligibility must be checked when mail is not received.
