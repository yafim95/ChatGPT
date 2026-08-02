import { Badge, Spinner, Text, Tooltip } from "@fluentui/react-components";
import {
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
} from "@fluentui/react-icons";

interface BackendStatusProps {
  connected: boolean;
  checking?: boolean;
  version?: string;
}

export function BackendStatus({
  connected,
  checking = false,
  version,
}: BackendStatusProps): React.JSX.Element {
  if (checking) {
    return (
      <div className="backend-status">
        <Spinner size="tiny" />
        <Text size={200}>Checking local service</Text>
      </div>
    );
  }

  const label = connected
    ? `Local service connected · v${version ?? "—"}`
    : "Local service offline";
  return (
    <Tooltip content={label} relationship="label">
      <Badge
        appearance="tint"
        color={connected ? "success" : "danger"}
        icon={connected ? <CheckmarkCircle20Filled /> : <ErrorCircle20Filled />}
      >
        {connected ? "Connected" : "Offline"}
      </Badge>
    </Tooltip>
  );
}
