
import { useState } from 'react';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Separator,
  ThemeSwitcher,
  Toast,
} from '@gurusthalam/ui';

import { InteractionPreview } from './interaction-preview';
import styles from './app.module.css';

export function App() {
  const [notificationVisible, setNotificationVisible] = useState(false);

  return (
    <main className={styles.integrationPage}>
      <PageHeader
        eyebrow="Gurusthalam · Administration"
        title="Administration workspace"
        description="Shared UI library integration preview."
        actions={
          <div className={styles.headerActions}>
            <ThemeSwitcher />
            <Button
              variant="secondary"
              onClick={() => setNotificationVisible(true)}
            >
              Show notification
            </Button>
          </div>
        }
      />

      <section
        className={styles.integrationGrid}
        aria-label="Administration UI integration"
      >
        <Card className={styles.integrationCard}>
          <div className={styles.cardContent}>
            <div className={styles.identityRow}>
              <Avatar name="Gurusthalam Administrator" size="large" />

              <div className={styles.identityContent}>
                <h2 className={styles.cardTitle}>Administrator preview</h2>
                <p className={styles.cardDescription}>
                  Shared identity and status components.
                </p>
              </div>
            </div>

            <div className={styles.statusRow}>
              <Badge variant="success">UI package connected</Badge>
              <Badge variant="info">Integration preview</Badge>
            </div>

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
            <h2 className={styles.cardTitle}>Empty state component</h2>

            <EmptyState
              title="No administration modules in this preview"
              description="Administration workflows will be implemented in their designated product phases."
            />
          </div>
        </Card>
      </section>

      <Separator decorative={false} />

      <InteractionPreview />

      <Separator decorative={false} />

      <section className={styles.integrationFooter}>
        <h2 className={styles.cardTitle}>Integration scope</h2>

        <p className={styles.cardDescription}>
          This preview verifies that the Admin application can resolve and
          render shared UI components through the workspace package. It does not
          represent a completed administration feature.
        </p>
      </section>

      {notificationVisible ? (
        <Toast
          variant="success"
          title="Shared UI notification"
          description="The Admin application successfully rendered the shared Toast component."
          onDismiss={() => setNotificationVisible(false)}
        />
      ) : null}
    </main>
  );
}

export default App;
