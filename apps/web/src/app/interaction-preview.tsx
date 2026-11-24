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
  const [selectedAction, setSelectedAction] = useState(
    'No dropdown action selected yet.',
  );

  return (
    <section
      className={styles.interactionSection}
      aria-labelledby="interaction-preview-title"
    >
      <div className={styles.sectionHeading}>
        <h2 id="interaction-preview-title">Shared interaction components</h2>

        <p>
          Browser-based verification of Dialog, Tabs, Tooltip and Dropdown Menu
          from the shared UI package.
        </p>
      </div>

      <div className={styles.interactionGrid}>
        {/* Dialog */}
        <article className={styles.interactionCard}>
          <h3>1. Dialog</h3>

          <p>
            Verify opening, closing, Escape dismissal and keyboard focus
            management.
          </p>

          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>

          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Dialog interaction test"
            description="This dialog is rendered by the shared Gurusthalam UI library."
          >
            <div className={styles.dialogTestContent}>
              <p>
                If you can see this message, the shared Dialog component
                rendered successfully.
              </p>

              <p>Test the close button, Escape key and overlay dismissal.</p>

              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                Close dialog
              </Button>
            </div>
          </Dialog>
        </article>

        {/* Tabs */}
        <article className={styles.interactionCard}>
          <h3>2. Tabs</h3>

          <p>
            Verify mouse selection, content switching and keyboard navigation.
          </p>

          <Tabs defaultValue="overview">
            <TabsList label="Interaction test sections">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="lessons">Lessons</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className={styles.tabPanel}>
                <strong>Overview selected</strong>
                <p>
                  This is the Overview tab content. Select another tab to verify
                  content switching.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="lessons">
              <div className={styles.tabPanel}>
                <strong>Lessons selected</strong>
                <p>
                  This is the Lessons tab content. The selected tab should
                  change when you activate it.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="resources">
              <div className={styles.tabPanel}>
                <strong>Resources selected</strong>
                <p>
                  This is the Resources tab content. Try navigating to it using
                  the keyboard arrow keys.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </article>

        {/* Tooltip */}
        <article className={styles.interactionCard}>
          <h3>3. Tooltip</h3>

          <p>
            Verify that the tooltip appears on mouse hover and keyboard focus.
          </p>

          <div className={styles.tooltipTestArea}>
            <Tooltip
              content="This is a shared Gurusthalam tooltip."
              placement="top"
            >
              <button type="button" className={styles.previewAction}>
                Hover or focus for help
              </button>
            </Tooltip>
          </div>

          <p className={styles.testHint}>
            Move the mouse over the button, then move away. Also try the Tab
            key.
          </p>
        </article>

        {/* Dropdown Menu */}
        <article className={styles.interactionCard}>
          <h3>4. Dropdown Menu</h3>

          <p>
            Verify menu opening, action selection, dismissal and keyboard
            navigation.
          </p>

          <DropdownMenu>
            <DropdownMenuTrigger>Course actions</DropdownMenuTrigger>

            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() =>
                  setSelectedAction('Edit Course action selected successfully.')
                }
              >
                Edit Course
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() =>
                  setSelectedAction(
                    'Duplicate Course action selected successfully.',
                  )
                }
              >
                Duplicate Course
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={() =>
                  setSelectedAction(
                    'Archive Course action selected successfully.',
                  )
                }
              >
                Archive Course
              </DropdownMenuItem>

              <DropdownMenuItem disabled>Disabled action</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className={styles.actionResult} role="status" aria-live="polite">
            {selectedAction}
          </div>

          <p className={styles.testHint}>
            Open the menu and try the arrow keys, Home, End and Escape. Also try
            clicking outside.
          </p>
        </article>
      </div>
    </section>
  );
}

export default InteractionPreview;
