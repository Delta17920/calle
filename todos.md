# Final Setup To-Dos

Here is the checklist of what's remaining to get the hardened app fully up and running in your environment:

- [ ] **Provision DynamoDB Table**
  - I've created the Terraform config in [`main.tf`](file:///d:/calle/calle/main.tf).
  - Simply run `terraform init` and `terraform apply` to create the table!

- [ ] **Configure Public Webhook (Local Testing)**
  - Run `ngrok http 8787` in a separate terminal.
  - Copy the HTTPS URL and paste it into `PUBLIC_BASE_URL` in your `.env`.
  - Restart `npm run dev`.

- [ ] **CALL-E Dedicated Number**
  - Go to the [CALL-E Dashboard](https://dashboard.heycall-e.com/).
  - Buy a dedicated phone number (to avoid the free-tier shared queue).
  - Set it as your default outbound number.

- [ ] **AWS IAM Permissions**
  - Fill in your `ECS_CLUSTER`, `ECS_SERVICE`, and `CW_ALARM_NAME` in `.env`.
  - Ensure the AWS credentials (or IAM Role) the app uses has permissions for:
    - `ecs:UpdateService`
    - `ecs:DescribeServices`
    - `cloudwatch:GetMetricData`
    - `ec2:DescribeSecurityGroups`
