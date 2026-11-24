import { useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  Progress,
  Separator,
  Toast,
} from '@gurusthalam/ui';

import { InteractionPreview } from './interaction-preview.js';
import styles from './app.module.css';

export function App() {
  const [notificationVisible, setNotificationVisible] = useState(false);

  return (
    <main className={styles.integrationPage}>
      <PageHeader
        eyebrow="Gurusthalam · Web application"
        title="Learner workspace"
        description="Shared UI library integration preview."
        actions={
          <Button
            variant="secondary"
            size="medium"
            onClick={() => setNotificationVisible(true)}
          >
            Show notification
          </Button>
        }
      />

      <Alert variant="success" title="Shared UI package connected">
        The Web application is consuming components through the @gurusthalam/ui
        workspace package.
      </Alert>

      <section
        className={styles.integrationGrid}
        aria-label="Shared UI component integration"
      >
        <Card className={styles.integrationCard}>
          <div className={styles.cardContent}>
            <div className={styles.statusRow}>
              <Badge variant="success">Connected</Badge>
              <span className={styles.mutedText}>Package integration</span>
            </div>

            <h2 className={styles.cardTitle}>Public component API</h2>

            <p className={styles.cardDescription}>
              Page headers, cards, badges, alerts and buttons are imported
              through the shared package entry point.
            </p>

            <Button
              variant="primary"
              onClick={() => setNotificationVisible(true)}
            >
              Test shared button
            </Button>
          </div>
        </Card>

        <Card className={styles.integrationCard}>
          <div className={styles.cardContent}>
            <h2 className={styles.cardTitle}>Progress component</h2>

            <p className={styles.cardDescription}>
              Example rendering of the shared progress indicator.
            </p>

            <Progress
              label="Example progress"
              value={65}
              max={100}
              showValue
              size="medium"
            />
          </div>
        </Card>
      </section>

      <Separator decorative={false} />

      <section className={styles.integrationFooter}>
        <h2 className={styles.cardTitle}>Integration scope</h2>

        <p className={styles.cardDescription}>
          This preview verifies package resolution and component rendering.
          Learner workflows and production data integrations remain separate
          implementation phases.
        </p>
      </section>

      <InteractionPreview />

      {notificationVisible ? (
        <Toast
          variant="success"
          title="Shared UI notification"
          description="The Web application successfully rendered the shared Toast component."
          onDismiss={() => setNotificationVisible(false)}
        />
      ) : null}
    </main>
  );
}

export default App;
