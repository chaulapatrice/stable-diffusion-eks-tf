import { Construct } from "constructs";
import { App, TerraformStack, Token, TerraformAsset, AssetType, TerraformOutput, TerraformVariable, Fn } from "cdktf";
import { DataAwsIamPolicyDocument } from "@cdktf/provider-aws/lib/data-aws-iam-policy-document";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import * as aws from "@cdktf/provider-aws";
import * as path from "path";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambda-permission";


import 'dotenv/config'
import { SqsPolicyAttachment } from "./sqsPolicy";

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const region = new TerraformVariable(this, "AWS_REGION", {});
    const accountId = new TerraformVariable(this, "AWS_ACCOUNT_ID", {})
    new AwsProvider(this, "AWS", {
      region: region.value,
    });

    const lambdaAsset = new TerraformAsset(this, "lambda-asset", {
      path: path.resolve(__dirname, 'lambda'),
      type: AssetType.ARCHIVE
    })

    // Create S3 bucket
    const bucket = new aws.s3Bucket.S3Bucket(this, "bucket", {
      bucketPrefix: 'sd-on-eks'
    });


    // Upload archive to S3 bucket 
    const lambdaArchive = new aws.s3Object.S3Object(this, "lambda-archive", {
      bucket: bucket.bucket,
      key: `request_validator_lambda/${lambdaAsset.fileName}`,
      source: lambdaAsset.path, //returns a posix path
    })

    const assumeRole = new DataAwsIamPolicyDocument(this, "assume_role", {
      statement: [
        {
          actions: ["sts:AssumeRole"],
          effect: "Allow",
          principals: [
            {
              identifiers: ["lambda.amazonaws.com"],
              type: "Service"
            }
          ]
        }
      ]
    })

    const iamForLambda = new IamRole(this, "iam_for_lambda", {
      assumeRolePolicy: Token.asString(assumeRole.json),
      name: "iam_for_lambda"
    });

        // Add execution role for lambda to write to CloudWatch logs
    new aws.iamRolePolicyAttachment.IamRolePolicyAttachment(this, "lambda-managed-policy", {
      policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      role: iamForLambda.name
    });

    const inputSnsTopic = new aws.snsTopic.SnsTopic(this, "input_sns_topic", {
      name:"sd-on-eks-topic.fifo",
      fifoTopic: true,
    });

    const inputSqsQueueModelA = new aws.sqsQueue.SqsQueue(this, "input_sqs_queue_model_a", {
      maxMessageSize: 2048,
      messageRetentionSeconds: 86400,
      name: "sd-on-eks-input-sqs-model-a.fifo",
      receiveWaitTimeSeconds: 10, 
      fifoQueue: true,
    });

    // Attach SQS policy
    new SqsPolicyAttachment(this, "attach_input_sqs_queue_model_a_policy", {
      sqsQueue: inputSqsQueueModelA,
      accountId,
      sourceArn: inputSnsTopic.arn
    })



    // Subscribe queue to input sns topic
    new aws.snsTopicSubscription.SnsTopicSubscription(this, "input_sqs_queue_model_a_subscription", {
      endpoint: inputSqsQueueModelA.arn,
      protocol: "sqs",
      topicArn: inputSnsTopic.arn
    });

    const inputSqsQueueModelB = new aws.sqsQueue.SqsQueue(this, "input_sqs_queue_model_b", {
      maxMessageSize: 2048,
      messageRetentionSeconds: 86400,
      name: "sd-on-eks-input-sqs-model-b.fifo",
      receiveWaitTimeSeconds: 10, 
      fifoQueue: true,
    });

    // Attach SQS policy
    new SqsPolicyAttachment(this, "attach_input_sqs_queue_model_b_policy", {
      sqsQueue: inputSqsQueueModelB,
      accountId,
      sourceArn: inputSnsTopic.arn
    })

    // Subscribe queue to input sns topic
    new aws.snsTopicSubscription.SnsTopicSubscription(this, "input_sqs_queue_model_b_subscription", {
      endpoint: inputSqsQueueModelB.arn,
      protocol: "sqs",
      topicArn: inputSnsTopic.arn
    });

    const inputSqsQueueModelC = new aws.sqsQueue.SqsQueue(this, "input_sqs_queue_model_c", {
      maxMessageSize: 2048,
      messageRetentionSeconds: 86400,
      name: "sd-on-eks-input-sqs-model-c.fifo",
      receiveWaitTimeSeconds: 10, 
      fifoQueue: true,
      visibilityTimeoutSeconds: 30,
    });

    // Subscribe queue to input sns topic
    new aws.snsTopicSubscription.SnsTopicSubscription(this, "input_sqs_queue_model_c_subscription", {
      endpoint: inputSqsQueueModelC.arn,
      protocol: "sqs",
      topicArn: inputSnsTopic.arn
    });

    // Attach SQS policy
    new SqsPolicyAttachment(this, "attach_input_sqs_queue_model_c_policy", {
      sqsQueue: inputSqsQueueModelC,
      accountId,
      sourceArn: inputSnsTopic.arn
    })



    // Output
    const outputSnsTopic = new aws.snsTopic.SnsTopic(this, "output_sns_topic", {
      name:"sd-on-eks-output-topic.fifo",
      fifoTopic: true,
    });

    const outputSqsQueue = new aws.sqsQueue.SqsQueue(this, "output_sqs_queue", {
      maxMessageSize: 2048,
      messageRetentionSeconds: 86400,
      name: "sd-on-eks-output-sqs.fifo",
      receiveWaitTimeSeconds: 10, 
      fifoQueue: true,
    });

    // Attach SQS policy
    new SqsPolicyAttachment(this, "attach_output_sqs_queue_policy", {
      sqsQueue: outputSqsQueue,
      accountId,
      sourceArn: outputSnsTopic.arn
    });



    // Subscribe queue to output sns topic
    new aws.snsTopicSubscription.SnsTopicSubscription(this, "output_sqs_queue_subscription", {
      endpoint: outputSqsQueue.arn,
      protocol: "sqs",
      topicArn: outputSnsTopic.arn
    });


    const requestValidatorLambda = new LambdaFunction(this, "request_validator_lambda", {
      environment: {
        variables: {
          FOO: "bar",
        },
      },
      functionName: "request_validator_lambda",
      s3Bucket: bucket.bucket,
      s3Key: lambdaArchive.key,
      handler: "index.handler",
      runtime: "nodejs18.x",
      role: iamForLambda.arn,
    });

    // Create and configure API gateway
    const api = new aws.apiGatewayRestApi.ApiGatewayRestApi(this, "api_gw", {
      name: "request_validator_api"
    })

    const resource = new aws.apiGatewayResource.ApiGatewayResource(this, "api_gw_resource", {
      parentId: api.rootResourceId,
      pathPart: "resource",
      restApiId: api.id
    })

    const method = new aws.apiGatewayMethod.ApiGatewayMethod(this, "api_gw_method", {
      authorization: "NONE",
      httpMethod: "GET",
      resourceId: resource.id,
      restApiId: api.id
    })

    const sourceArn = "arn:aws:execute-api:${" +
    region.value +
    "}:${" +
    accountId.value +
    "}:${" +
    api.id +
    "}/*/${" +
    method.httpMethod +
    "}${" +
    resource.path +
    "}"

    new LambdaPermission(this, "api_gw_lambda_invoke_permission", {
      action: "lambda:InvokeFunction",
      functionName: requestValidatorLambda.functionName,
      principal: "apigateway.amazonaws.com",
      sourceArn,
      statementId: "AllowExecutionFromAPIGateway",
    });

    const integration = new aws.apiGatewayIntegration.ApiGatewayIntegration(this, "api_gw_integration", {
      httpMethod: method.httpMethod,
      integrationHttpMethod: "POST",
      resourceId: resource.id,
      restApiId: api.id,
      type: "AWS_PROXY",
      uri: requestValidatorLambda.invokeArn
    });


    const apiGatewayDeployment = new aws.apiGatewayDeployment.ApiGatewayDeployment(this, "api_gw_deployment", {
      restApiId: api.id,
      triggers: {
        redeployment: Token.asString(Fn.jsonencode([
          resource.id,
          method.id,
          integration.id
        ]))
      }
    })

    new aws.apiGatewayStage.ApiGatewayStage(this, "api_gw_stage", {
      deploymentId: apiGatewayDeployment.id,
      restApiId: api.id,
      stageName: "prod"
    })
    
    new TerraformOutput(this, 'url', {
          value: `https://${api.id}.execute-api./${region.value}.amazonaws.com`
    });

  }
}

const app = new App();
new MyStack(app, "stable-difusion-on-eks-tf");
app.synth();
