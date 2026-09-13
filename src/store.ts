import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { Incident } from "./types.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const client = new DynamoDBClient({ region: config.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = config.DYNAMODB_TABLE_NAME;

export async function listIncidents(): Promise<Incident[]> {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const items = (data.Items as Incident[]) || [];
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.error("Failed to list incidents from DynamoDB:", error);
    return [];
  }
}

export async function getIncident(id: string): Promise<Incident | undefined> {
  try {
    const data = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id }
    }));
    return data.Item as Incident | undefined;
  } catch (error) {
    console.error(`Failed to get incident ${id}:`, error);
    return undefined;
  }
}

export async function getIncidentByCallId(callId: string): Promise<Incident | undefined> {
  const incidents = await listIncidents();
  return incidents.find(
    (item) =>
      item.calleCallId === callId || item.escalateCallId === callId || item.resultCallId === callId
  );
}

export async function saveIncident(incident: Incident): Promise<Incident> {
  const currentVersion = incident.version || 0;
  const next = { ...incident, version: currentVersion + 1, updatedAt: new Date().toISOString() };
  try {
    const params: any = {
      TableName: TABLE_NAME,
      Item: next,
    };
    if (currentVersion > 0) {
      params.ConditionExpression = "version = :prevVersion";
      params.ExpressionAttributeValues = { ":prevVersion": currentVersion };
    } else {
      params.ConditionExpression = "attribute_not_exists(id)";
    }
    
    await docClient.send(new PutCommand(params));
    return next;
  } catch (error) {
    console.error(`Failed to save incident ${incident.id}:`, error);
    throw error;
  }
}

export async function findOpenAlarmIncident(alarmName: string): Promise<Incident | undefined> {
  const incidents = await listIncidents();
  return incidents.find((item) => 
    item.alarmName === alarmName && 
    !["resolved", "failed", "escalated", "no_answer", "timeout"].includes(item.status)
  );
}

// Keep these basic for now, or move to DynamoDB if needed
const processedEventIds: string[] = [];

export async function hasProcessedEvent(eventId: string): Promise<boolean> {
  return processedEventIds.includes(eventId);
}

export async function markProcessedEvent(eventId: string): Promise<void> {
  if (!processedEventIds.includes(eventId)) {
    processedEventIds.push(eventId);
    if (processedEventIds.length > 500) {
      processedEventIds.splice(0, processedEventIds.length - 400);
    }
  }
}
