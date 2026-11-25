import { expectTypeOf, it } from 'vitest';

import type {
  AlertProps,
  AlertVariant,
  AvatarProps,
  AvatarShape,
  AvatarSize,
  BadgeProps,
  BadgeVariant,
  ButtonProps,
  ButtonSize,
  ButtonVariant,
  CardProps,
  CheckboxProps,
  DialogProps,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuProps,
  DropdownMenuSeparatorProps,
  DropdownMenuTriggerProps,
  EmptyStateProps,
  InputProps,
  PageHeaderHeadingLevel,
  PageHeaderProps,
  PaginationItem,
  PaginationProps,
  ProgressProps,
  ProgressSize,
  ProgressVariant,
  RadioGroupProps,
  RadioOption,
  RadioProps,
  SelectProps,
  SeparatorOrientation,
  SeparatorProps,
  SkeletonProps,
  SkeletonVariant,
  StatCardProps,
  SwitchProps,
  TabsActivationMode,
  TabsContentProps,
  TabsListProps,
  TabsOrientation,
  TabsProps,
  TabsTriggerProps,
  TextareaProps,
  ToastProps,
  ToastVariant,
  TooltipPlacement,
  TooltipProps,
  ListItemProps,
  ListProps,
  ListSize,
  ListVariant,
  FormActionsAlign,
  FormActionsJustify,
  FormActionsProps,
  FormFieldProps,
  FormProps,
  FormSectionProps,
} from './index.js';

/**
 * Compile-time contract for the public type exports of @gurusthalam/ui.
 *
 * Importing these types through the root barrel verifies that consumers
 * can access the supported component contracts without importing internal
 * implementation files.
 */
export type PublicApiTypeContract = {
  button: ButtonProps;
  buttonSize: ButtonSize;
  buttonVariant: ButtonVariant;

  card: CardProps;
  statCard: StatCardProps;

  avatar: AvatarProps;
  avatarShape: AvatarShape;
  avatarSize: AvatarSize;

  badge: BadgeProps;
  badgeVariant: BadgeVariant;

  alert: AlertProps;
  alertVariant: AlertVariant;
  emptyState: EmptyStateProps;

  progress: ProgressProps;
  progressSize: ProgressSize;
  progressVariant: ProgressVariant;

  skeleton: SkeletonProps;
  skeletonVariant: SkeletonVariant;

  toast: ToastProps;
  toastVariant: ToastVariant;

  input: InputProps;
  textarea: TextareaProps;
  select: SelectProps;

  dialog: DialogProps;

  tabs: TabsProps;
  tabsList: TabsListProps;
  tabsTrigger: TabsTriggerProps;
  tabsContent: TabsContentProps;
  tabsOrientation: TabsOrientation;
  tabsActivationMode: TabsActivationMode;

  tooltip: TooltipProps;
  tooltipPlacement: TooltipPlacement;

  dropdownMenu: DropdownMenuProps;
  dropdownMenuTrigger: DropdownMenuTriggerProps;
  dropdownMenuContent: DropdownMenuContentProps;
  dropdownMenuItem: DropdownMenuItemProps;
  dropdownMenuSeparator: DropdownMenuSeparatorProps;

  pagination: PaginationProps;
  paginationItem: PaginationItem;

  pageHeader: PageHeaderProps;
  pageHeaderHeadingLevel: PageHeaderHeadingLevel;

  separator: SeparatorProps;
  separatorOrientation: SeparatorOrientation;

  checkbox: CheckboxProps;
  radio: RadioProps;
  radioGroup: RadioGroupProps;
  radioOption: RadioOption;
  switch: SwitchProps;

  form: FormProps;
  formField: FormFieldProps;
  formSection: FormSectionProps;
  formActions: FormActionsProps;
  formActionsAlign: FormActionsAlign;
  formActionsJustify: FormActionsJustify;

  list: ListProps;
  listItem: ListItemProps;
  listSize: ListSize;
  listVariant: ListVariant;
};

describe('@gurusthalam/ui public type API', () => {
  it('exposes the complete public type contract', () => {
    expectTypeOf<PublicApiTypeContract>().toBeObject();
  });

  it('exposes component prop contracts as object types', () => {
    expectTypeOf<ButtonProps>().toBeObject();
    expectTypeOf<CardProps>().toBeObject();
    expectTypeOf<StatCardProps>().toBeObject();

    expectTypeOf<AvatarProps>().toBeObject();
    expectTypeOf<BadgeProps>().toBeObject();

    expectTypeOf<AlertProps>().toBeObject();
    expectTypeOf<EmptyStateProps>().toBeObject();
    expectTypeOf<ProgressProps>().toBeObject();
    expectTypeOf<SkeletonProps>().toBeObject();
    expectTypeOf<ToastProps>().toBeObject();

    expectTypeOf<InputProps>().toBeObject();
    expectTypeOf<TextareaProps>().toBeObject();
    expectTypeOf<SelectProps>().toBeObject();

    expectTypeOf<DialogProps>().toBeObject();
    expectTypeOf<TabsProps>().toBeObject();
    expectTypeOf<TabsListProps>().toBeObject();
    expectTypeOf<TabsTriggerProps>().toBeObject();
    expectTypeOf<TabsContentProps>().toBeObject();

    expectTypeOf<TooltipProps>().toBeObject();

    expectTypeOf<DropdownMenuProps>().toBeObject();
    expectTypeOf<DropdownMenuTriggerProps>().toBeObject();
    expectTypeOf<DropdownMenuContentProps>().toBeObject();
    expectTypeOf<DropdownMenuItemProps>().toBeObject();
    expectTypeOf<DropdownMenuSeparatorProps>().toBeObject();

    expectTypeOf<PaginationProps>().toBeObject();

    expectTypeOf<PageHeaderProps>().toBeObject();
    expectTypeOf<SeparatorProps>().toBeObject();

    expectTypeOf<CheckboxProps>().toBeObject();
    expectTypeOf<RadioProps>().toBeObject();
    expectTypeOf<RadioGroupProps>().toBeObject();
    expectTypeOf<RadioOption>().toBeObject();
    expectTypeOf<SwitchProps>().toBeObject();
    expectTypeOf<ListProps>().toBeObject();
    expectTypeOf<ListItemProps>().toBeObject();
    expectTypeOf<FormProps>().toBeObject();
    expectTypeOf<FormFieldProps>().toBeObject();
    expectTypeOf<FormSectionProps>().toBeObject();
    expectTypeOf<FormActionsProps>().toBeObject();
  });

  it('exposes component variants and configuration types as string types', () => {
    expectTypeOf<ButtonSize>().toBeString();
    expectTypeOf<ButtonVariant>().toBeString();

    expectTypeOf<AvatarShape>().toBeString();
    expectTypeOf<AvatarSize>().toBeString();
    expectTypeOf<BadgeVariant>().toBeString();

    expectTypeOf<AlertVariant>().toBeString();
    expectTypeOf<ProgressSize>().toBeString();
    expectTypeOf<ProgressVariant>().toBeString();
    expectTypeOf<SkeletonVariant>().toBeString();
    expectTypeOf<ToastVariant>().toBeString();

    expectTypeOf<TabsOrientation>().toBeString();
    expectTypeOf<TabsActivationMode>().toBeString();
    expectTypeOf<TooltipPlacement>().toBeString();

    expectTypeOf<PageHeaderHeadingLevel>().toBeString();
    expectTypeOf<SeparatorOrientation>().toBeString();
    expectTypeOf<ListSize>().toBeString();
    expectTypeOf<ListVariant>().toBeString();
    expectTypeOf<FormActionsAlign>().toBeString();
    expectTypeOf<FormActionsJustify>().toBeString();
  });

  it('exposes PaginationItem as the supported pagination item union', () => {
    expectTypeOf<PaginationItem>().toEqualTypeOf<
      number | 'start-ellipsis' | 'end-ellipsis'
    >();
  });
});
