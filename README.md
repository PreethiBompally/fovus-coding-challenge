Fovus Coding Challege

Steps to run:
Pre-requisites: Configure AWS on your local system.
1. Clone or Fork this repository.
2. Navigate to fovus-cdk folder.
3. Run:
    - "npm install" to install all the node modules.
    - "cdk bootstarp"
    - "cdk deploy" to create all the AWS rescources.
    - "npm run extract-api-url"to extract the API Gateway urls to a file.
4. Navigate to fovus-react-app folder.
5. Run:
    - "npm install" to install all the node modules.
    - "npm start" to start the application.
6. Insert an input text and upload a file, click submit.
7. Check for Dynamo-db record and navigate to the output file using the output file path in the record.
8. Download the file and check if the text is appended.


Project flow:

AWS cdk script:
1. Creates a S3 bucket and uploads a script file.
2. Creates a "FovusFileStorage" DynamoDB table.
3. Creates an IAM role with permissions to access S3 bucket, DynamoDB table and to carry EC2 instace actions and also creates profile for EC2 Instance.
3. Creates 3 Lambda functions:
    - getPreSignedUrl: generates a pre-signed url to insert the file uploaded by the user.
        * inputs: file name
        * Environment variables: bucket name and region
    - insertToDynamoDB: inserts the file path and input text into Dynamodb Table
        * inputs: operation(create, read, update, delete or echo) and payload(a JSON object containing table record parameters)
        * Environment variables: Dynamodb table name
    - initiateEC2: Creates a EC2 instance and downloads the script file from S3 bcucket and runs the script file and terminates the EC2 instace. This is triggered as DynamoDB Event.
        * input: new record created in DynamoDB.
        * Environment variables: AMI(Amazon Machine Image) ID, S3 bucket name, Role arn, DynamoDB table name.
4. Creates 2 API Gateways:
    - GeneratePSUrl: Triggers "getPreSignedUrl" lambda function.
    - DynamoDB_Api: Triggers "insertToDynamoDB" lambda function.

React code:
1. Gets the 2 API Gateway urls from the text file.
2. Initiates the GeneratePSUrl and uses the returned pre-signed url to upload the input file into S3 bucket.
3. Initiates the DynamoDB_Api which takes care of the rest of the process.