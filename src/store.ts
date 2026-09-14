import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { Incident } from "./types.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const client = new DynamoDBClient({ region: config.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});
const TABLE_NAME = config.DYNAMODB_TABLE_NAME;

const MOCK_INCIDENTS: any[] = [
  {
    id: "mock-1",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "in-progress",
    source: "console",
    scenarioId: "High CPU Alarm",
    triggerReason: "Simulated CPU spike across production cluster",
    sayOnPhone: "Execute code {code}",
    confirmationCode: "743",
    fixCommand: "aws ecs update-service --cluster prod --service web --desired-count 10",
    snapshot: {
      region: "ap-southeast-1",
      cluster: "prod-cluster",
      service: "web-svc",
      runningCount: 2,
      desiredCount: 2,
      pendingCount: 0,
      currentRevision: "task-rev-42",
      alarm: { name: "HighCPU", state: "ALARM", reason: "CPU > 90%" },
      cpuPercent: 95
    }
  },
  {
    id: "mock-2",
    version: 1,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    status: "resolved",
    source: "alarm",
    scenarioId: "Database Failure",
    triggerReason: "Database connections dropping",
    sayOnPhone: "Restart database {code}",
    confirmationCode: "112",
    fixCommand: "aws rds reboot-db-instance --db-instance-identifier prod-db",
    snapshot: {
      region: "ap-southeast-1",
      alarm: { name: "DBConnDrop", state: "ALARM" }
    },
    spoken: "Restart database one one two",
    execution: "Success",
    transcript: [
      { speaker: "bot", text: "Alert. Database connections dropping. What is your command?" },
      { speaker: "user", text: "Restart database one one two." },
      { speaker: "bot", text: "Command confirmed. Executing." }
    ]
  }
];

export async function listIncidents(): Promise<Incident[]> {
  return MOCK_INCIDENTS.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as Incident[];
}

export async function getIncident(id: string): Promise<Incident | undefined> {
  return MOCK_INCIDENTS.find(i => i.id === id) as Incident | undefined;
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
  const existingIndex = MOCK_INCIDENTS.findIndex(i => i.id === incident.id);
  if (existingIndex >= 0) {
    MOCK_INCIDENTS[existingIndex] = next;
  } else {
    MOCK_INCIDENTS.push(next);
  }
  return next;
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
