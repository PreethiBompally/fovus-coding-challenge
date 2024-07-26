import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand,GetCommand,UpdateCommand,DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { nanoid } from 'nanoid';
const dynamodb = new DynamoDB({});

/**
 * Provide an event that contains the following keys:
 *
 *   - operation: one of 'create,' 'read,' 'update,' 'delete,' or 'echo'
 *   - payload: a JSON object containing the parameters for the table item
 *              to perform the operation on
 */
export const handler = async (event, context) => {
   
     const operation = event.operation;
     var id = nanoid();
     if (operation == 'echo'){
          return(event.payload);
     }
     
    else { 
        event.payload.TableName = process.env.TABLE_NAME;
        event.payload.Item.id = id;
        console.log(event.payload);
        
        switch (operation) {
          case 'create':
               await dynamodb.send(new PutCommand(event.payload));
               break;
          case 'read':
               var table_item = await dynamodb.send(new GetCommand(event.payload));
               console.log(table_item);
               break;
          case 'update':
               await dynamodb.send(new UpdateCommand(event.payload));
               break;
          case 'delete':
               await dynamodb.send(new DeleteCommand(event.payload));
               break;
          default:
            return ('Unknown operation: ${operation}');
          }
    }
};