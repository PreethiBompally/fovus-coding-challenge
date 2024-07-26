import boto3
import os

# Initialize AWS clients
region = os.getenv('AWS_DEFAULT_REGION')
s3 = boto3.client('s3', region_name = region)
dynamodb = boto3.resource('dynamodb', region_name = region)
ec2 = boto3.resource('ec2', region_name = region)
instance_id = os.environ.get('INSTANCE_ID')
print(f"Instace_ID: {instance_id}")

def download_file(bucket_name, file_name, local_path):
    s3.download_file(Bucket=bucket_name, Key=file_name, Filename=local_path)

def upload_file(bucket_name, file_name, local_path):
    s3.upload_file(Filename=local_path, Bucket=bucket_name, Key=file_name)

def get_dynamodb_data(table_name, item_id):
    table = dynamodb.Table(table_name)
    response = table.get_item(Key={'id': item_id})
    return response['Item']

def update_dynamodb_data(table_name, item_id, output_file_path):
    table = dynamodb.Table(table_name)
    response = table.update_item(
        Key={'id': item_id},
        UpdateExpression='SET output_file_path = :val',
        ExpressionAttributeValues={
            ':val': output_file_path
        }
    )
    return response

def main():
    # Configuration
    print("Process Started")
    bucket_name = os.getenv('S3_BUCKET_NAME')
    table_name = os.getenv('TABLE_NAME')
    item_id = os.getenv('ITEM_ID')
    print(f"bucket_name: {bucket_name}")
    print(f"table_name: {table_name}")
    print(f"item_id: {item_id}")

    # Get data from DynamoDB
    item_data = get_dynamodb_data(table_name, item_id)
    input_file = f"{item_data['input_file_path'].split('/')[1]}"
    output_file = "Output_" + input_file
    input_text = item_data['input_text']
    print(f"input_text: {input_text}")

    # File operations
    local_input_path = '/tmp/{input_file}'
    local_output_path = '/tmp/{output_file}'

    # Download input file
    download_file(bucket_name, input_file, local_input_path)
    # Read the input file and append text
    with open(local_input_path, 'r') as file:
        content = file.read()
    with open(local_output_path, 'w') as file:
        file.write(f"{content}\n{input_text}")

    # Upload the output file
    upload_file(bucket_name, output_file, local_output_path)
    # Update DynamoDB with the output file path
    s3_path = f"{bucket_name}/{output_file}"
    update_dynamodb_data(table_name, item_id, s3_path)

if __name__ == "__main__":
    main()
