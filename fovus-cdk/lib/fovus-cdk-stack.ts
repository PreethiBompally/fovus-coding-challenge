import * as cdk from 'aws-cdk-lib';
import { AttributeType, Table, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import {
  Cors,
  LambdaIntegration,
  RestApi,
  ApiKeySourceType,
  ApiKey,
  MethodOptions,
  Integration,
  MockIntegration,
  PassthroughBehavior,
} from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
const fs = require('fs');

export class FovusCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const myBucket = new s3.Bucket(this, 'StoreFiles', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    myBucket.addCorsRule({
      allowedHeaders: ["*"],
      allowedMethods: [
        s3.HttpMethods.GET,
        s3.HttpMethods.PUT,
        s3.HttpMethods.POST,
        s3.HttpMethods.DELETE
      ],
      allowedOrigins: ['*'],
    });

    new cdk.aws_s3_deployment.BucketDeployment(this, "Deployment", {
      sources: [cdk.aws_s3_deployment.Source.asset('resources/RunonEc2')],
      destinationBucket: myBucket,
    });

    const api = new RestApi(this, 'GeneratePSUrl', {
      restApiName: 'GeneratePSUrl',
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'Access-Control-Allow-Origin',
        ],
        allowCredentials: true,
      },
      apiKeySourceType: ApiKeySourceType.HEADER,
    });

    const apiKey = new ApiKey(this, 'ApiKey');

    const deployment = new cdk.aws_apigateway.Deployment(this, 'DeployPSUrlApi', {
      api,
    });

    const stage = new cdk.aws_apigateway.Stage(this, 'PSUrlApiStage', {
      deployment:deployment,
      stageName: 'dev',
    });

    const getUrlLambda = new lambda.Function(this, 'getPreSignedUrl', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'script.handler',
      environment: {
        S3_BUCKET_NAME: myBucket.bucketName,
        AWS_REGION1: 'us-east-2'
      },
      code: lambda.Code.fromAsset('resources/getPresignedUrl'),
    });

    const generateUrl = api.root.addResource('generateUrl');

    const methodOptions: MethodOptions = {
      apiKeyRequired: false,
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': cdk.aws_apigateway.Model.EMPTY_MODEL
          },
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Origin': true,

          },
        },
      ]
    };

    const lambdaApiIntegration = new LambdaIntegration(getUrlLambda, {
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
            'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
          
          responseTemplates: {
            'application/json': ''
          }
        }
      ],
      proxy: false
    });

    generateUrl.addMethod('POST', lambdaApiIntegration, methodOptions);

    const optionsMethod = generateUrl.node.findChild('OPTIONS') as cdk.aws_apigateway.Method;
    if (optionsMethod) {
      optionsMethod.addMethodResponse({
        statusCode: '200',
        responseModels: {
          'application/json': cdk.aws_apigateway.Model.EMPTY_MODEL
        },
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },
        
      });

      // Create a new MockIntegration with the desired configuration
      const newIntegration = new MockIntegration({
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
              'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST'",
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
            responseTemplates: {
              'application/json': ''
            }
          }
        ],
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestTemplates: {
          "application/json": "{\"statusCode\": 200}"
        },
      });
      
      (optionsMethod as any).integration = newIntegration;            
    }

    myBucket.grantReadWrite(getUrlLambda);

    const dbTable = new cdk.aws_dynamodb.Table(this, 'FovusFileStorage', {
      partitionKey: { name: 'id', type: cdk.aws_dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: cdk.aws_dynamodb.StreamViewType.NEW_IMAGE
    });
    const dynamodb_api = new RestApi(this, 'DynamoDB_Api', {
      restApiName: 'DynamoDB_Api',
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'Access-Control-Allow-Origin',
        ],
        allowCredentials: true,
      },
      apiKeySourceType: ApiKeySourceType.HEADER,
    });

    const dynamodb_apiKey = new ApiKey(this, 'DynamoDbApiKey');

    const deploy_dynamoapi = new cdk.aws_apigateway.Deployment(this, 'DeployDynamoDBApi', {
      api:dynamodb_api,
    });

    const dynamoapi_stage = new cdk.aws_apigateway.Stage(this, 'DeployDynamoDBApiStage', {
      deployment:deploy_dynamoapi,
      stageName: 'dev1',
    });

    const nanoidLayer = new cdk.aws_lambda.LayerVersion(this, 'nanoidLayer', {
      compatibleRuntimes: [ cdk.aws_lambda.Runtime.NODEJS_LATEST ],
      compatibleArchitectures: [ cdk.aws_lambda.Architecture.X86_64 ],
      code: cdk.aws_lambda.Code.fromAsset('resources/layer/nodejs.zip')
    })

    const insertLambda = new cdk.aws_lambda.Function(this, 'insertToDynamoDB', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_LATEST,
      handler: 'insert.handler',
      environment: {
        TABLE_NAME: dbTable.tableName,
      },
      code: cdk.aws_lambda.Code.fromAsset('resources/endpoints'),
      layers: [nanoidLayer]
    });
    insertLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
      resources: ["*"]
    }))

    const insert = dynamodb_api.root.addResource('insert');

    const dynamoLlambdaIntegration = new LambdaIntegration(insertLambda, {
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
            'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
          
          responseTemplates: {
            'application/json': ''
          }
        }
      ],
      proxy: false
    });

    insert.addMethod('POST', dynamoLlambdaIntegration, methodOptions);

    const role = new cdk.aws_iam.Role(this, 'Ec2InstanceRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('ec2.amazonaws.com')
    });

    const s3Policy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject'
      ],
      resources: ["*"]
    });

    const dynamoPolicy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:DeleteItem',
        'dynamodb:UpdateItem',
        'dynamodb:Scan',
        'dynamodb:Query'
      ],
      resources: ['*']
    });

    const ec2Policy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: [
        'ec2:StartInstances',
        'ec2:RunInstances',
        'ec2:TerminateInstances'
      ],
      resources: ["*"]
    });

    role.addToPolicy(s3Policy);
    role.addToPolicy(dynamoPolicy);
    role.addToPolicy(ec2Policy);

    const instancerole = new cdk.aws_iam.CfnInstanceProfile(this, 'Ec2InstanceProfile', {
      roles: [role.roleName]
    });
    const latestAmiId = ssm.StringParameter.valueForStringParameter(
      this,
      '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2'
    );
    const initiateEC2Lambda = new cdk.aws_lambda.Function(this, 'initiateEC2', {
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_10,
      handler: 'initiateEc2.handler',
      code: cdk.aws_lambda.Code.fromAsset('resources/initiateEc2'),
      timeout: cdk.Duration.seconds(300),
      environment: {
        ROLE: instancerole.attrArn,
        BUCKET_NAME: myBucket.bucketName,
        TABLE_NAME: dbTable.tableName,
        AMI_ID: latestAmiId,
      }
    });
    initiateEC2Lambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
        actions: ['ec2:StartInstances','ec2:RunInstances','iam:PassRole'],
        resources: ["*"]
    }))

    const lambdaEventSource = new cdk.aws_lambda_event_sources.DynamoEventSource(dbTable, {
      startingPosition: cdk.aws_lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 5,
      bisectBatchOnError: false,
      retryAttempts: 2,
      enabled: true,
    });
    initiateEC2Lambda.addEventSource(lambdaEventSource);

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url + "generateUrl",
    });
    
    new cdk.CfnOutput(this, 'DynamoDbApiUrl', {
      value: dynamodb_api.url + "insert",
    });
  }
}