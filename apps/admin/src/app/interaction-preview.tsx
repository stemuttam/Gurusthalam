
import { useState } from 'react';

import {
  Button,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from '@gurusthalam/ui';

import styles from './app.module.css';

export function InteractionPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  return (
    <section
      className={styles.interactionSection}
      aria-labelledby="interaction-preview-heading"
    >
      <div className={styles.sectionHeader}>
        <div>
          <h2
            id="interaction-preview-heading"
            className={styles.cardTitle}
          >
            Shared interaction components
          </h2>

          <p className={styles.cardDescription}>
            Browser-based verification of Dialog, Tabs, Tooltip and Dropdown
            Menu from the shared UI package.
          </p>
        </div>
      </div>

      <div className={styles.interactionGrid}>
        {/* Dialog */}
        <article className={styles.interactionCard}>
          <h3 className={styles.interactionTitle}>1. Dialog</h3>

          <p className={styles.cardDescription}>
            Verify opening, closing, Escape dismissal and keyboard focus
            management.
          </p>

          <div className={styles.interactionAction}>
            <Button
              variant="primary"
              onClick={() => setDialogOpen(true)}
            >
              Open dialog
            </Button>
          </div>

          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Admin dialog preview"
            description="This dialog is rendered by the shared Gurusthalam UI package."
          >
            <div className={styles.interactionContent}>
              <p className={styles.cardDescription}>
                Use the close control, Escape key, or overlay dismissal to
                verify the Dialog interaction.
              </p>

              <Button
                variant="primary"
                onClick={() => setDialogOpen(false)}
              >
                Close dialog
              </Button>
            </div>
          </Dialog>
        </article>

        {/* Tabs */}
        <article className={styles.interactionCard}>
          <h3 className={styles.interactionTitle}>2. Tabs</h3>

          <p className={styles.cardDescription}>
            Verify mouse selection, content switching and keyboard navigation.
          </p>

          <div className={styles.interactionControl}>
            <Tabs defaultValue="overview">
              <TabsList label="Admin interaction preview sections">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className={styles.interactionContent}>
                  <h4 className={styles.interactionSubheading}>
                    Overview selected
                  </h4>

                  <p className={styles.cardDescription}>
                    The shared Tabs component is rendering its overview panel.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="details">
                <div className={styles.interactionContent}>
                  <h4 className={styles.interactionSubheading}>
                    Details selected
                  </h4>

                  <p className={styles.cardDescription}>
                    The selected tab displays its corresponding content panel.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </article>

        {/* Tooltip */}
        <article className={styles.interactionCard}>
          <h3 className={styles.interactionTitle}>3. Tooltip</h3>

          <p className={styles.cardDescription}>
            Verify that the tooltip appears on mouse hover and keyboard focus.
          </p>

          <div className={styles.interactionControl}>
            <Tooltip
              content="This tooltip is provided by the shared UI package."
              placement="top"
            >
              <button
                type="button"
                className={styles.previewButton}
              >
                Hover or focus here
              </button>
            </Tooltip>
          </div>
        </article>

        {/* Dropdown Menu */}
        <article className={styles.interactionCard}>
          <h3 className={styles.interactionTitle}>4. Dropdown Menu</h3>

          <p className={styles.cardDescription}>
            Verify menu opening, action selection, dismissal and keyboard
            navigation.
          </p>

          <div className={styles.interactionControl}>
            <DropdownMenu>
              <DropdownMenuTrigger className={styles.previewButton}>
                Admin actions
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => setSelectedAction('View users')}
                >
                  View users
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => setSelectedAction('Manage courses')}
                >
                  Manage courses
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled
                  onSelect={() => setSelectedAction('Disabled action')}
                >
                  Disabled action
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p
            className={styles.actionResult}
            role="status"
            aria-live="polite"
          >
            {selectedAction
              ? `Selected action: ${selectedAction}`
              : 'No action selected yet.'}
          </p>
        </article>
      </div>
    </section>
  );
}

export default InteractionPreview;
