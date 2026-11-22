"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Button, Card, CardBody } from "@/components/ui";

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  message: string | null;
}

export class FirebaseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error): State {
    let message =
      "A Firestore authorization or connectivity error interrupted this view.";
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string | null;
      };
      if (parsed && typeof parsed.error === "string") {
        message = parsed.error.toLowerCase().includes("quota exceeded")
          ? "Daily Firestore free-tier quota was reached. Quota resets tomorrow."
          : `Access to ${parsed.path ?? "the requested resource"} was denied (${parsed.operationType ?? "read"}). Verify your active facility assignment.`;
      }
    } catch {
      if (error.message) {
        message = error.message;
      }
    }
    return { hasError: true, message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FirebaseErrorBoundary caught:", error.message, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardBody className="grid gap-4">
            <Alert
              tone="danger"
              title={this.props.title ?? "Clinical workspace access error"}
            >
              {this.state.message}
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => this.setState({ hasError: false, message: null })}
              >
                Retry view
              </Button>
            </div>
          </CardBody>
        </Card>
      );
    }

    return this.props.children;
  }
}
