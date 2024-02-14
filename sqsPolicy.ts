
import { DataAwsIamPolicyDocument } from "@cdktf/provider-aws/lib/data-aws-iam-policy-document";
import { SqsQueue } from "@cdktf/provider-aws/lib/sqs-queue";
import { SqsQueuePolicy } from "@cdktf/provider-aws/lib/sqs-queue-policy";
import { TerraformVariable, Token } from "cdktf";
import { Construct } from "constructs";
export interface SqsPolicyConfig {
    sqsQueue: SqsQueue
    accountId: TerraformVariable,
    sourceArn: string
}
export class SqsPolicyAttachment extends Construct {
    constructor(scope: Construct, id: string, config: SqsPolicyConfig) {
        super(scope, id)
        const policyDocument = new DataAwsIamPolicyDocument(this, `policy_document`, {
            version: "2012-10-17",
            policyId: "__default_policy_ID",
            statement: [
              {
                sid: "__owner_statement",
                effect: "Allow",
                principals: [
                  {
                    identifiers: [`arn:aws:iam::${config.accountId.value}:root`],
                    type: "AWS"
                  }
                ],
                resources: [
                  config.sqsQueue.arn
                ]
              },
              {
                actions: ["sqs:SendMessage"],
                effect: "Allow",
                principals: [
                    {
                        identifiers: ["sns.amazonaws.com"],
                        type: "Service"
                    }
                ],
                condition: [
                    {
                        test: "ArnEquals",
                        values: [config.sourceArn],
                        variable: "aws:SourceArn"
                    }
                ],
                resources: [config.sqsQueue.arn]
              }
            ]
          });

          new SqsQueuePolicy(this, `policy`, {
             policy: Token.asString(policyDocument.json),
             queueUrl: config.sqsQueue.url
          })
        
    }
}