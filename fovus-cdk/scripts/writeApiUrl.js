const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

AWS.config.update({ region: 'us-east-2' });

const cloudformation = new AWS.CloudFormation();
const stackName = 'FovusCdkStack';

async function getApiUrl() {
  try {
    const data = await cloudformation.describeStacks({ StackName: stackName }).promise();
    const outputs = data.Stacks[0].Outputs;
    const apiUrlOutput = outputs.find(output => output.OutputKey === 'ApiUrl');
    const apiUrl = apiUrlOutput.OutputValue;
    const dynamoUrlOutput = outputs.find(output => output.OutputKey === 'DynamoDbApiUrl');
    const dynamoUrl = dynamoUrlOutput.OutputValue;

    const currentDir = __dirname;
    const parentDir = path.resolve(path.resolve(currentDir, '..'),'..');
    const outputDir = path.join(parentDir, 'public');
    const filePath = path.join(outputDir, 'api_url.txt');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const content = JSON.stringify({
      generateUrl: apiUrl,
      DynamoDBUrl: dynamoUrl
    }, null, 2);
    
    fs.writeFileSync(filePath, content, 'utf8');

    console.log(`API URL saved to ${filePath}`);
  } catch (err) {
    console.error('Error retrieving stack outputs:', err);
  }
}

getApiUrl();
