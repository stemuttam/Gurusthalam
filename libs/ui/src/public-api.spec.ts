import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Form,
  FormActions,
  FormErrorSummary,
  FormField,
  FormSection,
  Input,
  List,
  ListItem,
  PageHeader,
  Pagination,
  Progress,
  Radio,
  RadioGroup,
  Select,
  Separator,
  Skeleton,
  StatCard,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toast,
  Tooltip,
  FORM_LEVEL_ERROR_KEY,
  validationErrorToFormErrors,
  validationIssuesToFormErrors,
  validationResultToFormErrors,
} from './index.js';

describe('@gurusthalam/ui public API', () => {
  const publicComponents = {
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    Checkbox,
    Dialog,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    EmptyState,
    Form,
    FormActions,
    FormErrorSummary,
    FormField,
    FormSection,
    Input,
    List,
    ListItem,
    PageHeader,
    Pagination,
    Progress,
    Radio,
    RadioGroup,
    Select,
    Separator,
    Skeleton,
    StatCard,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
    Toast,
    Tooltip,
  };

  it('exports every currently supported public component', () => {
    expect(Object.keys(publicComponents)).toHaveLength(38);
  });

  it.each(Object.entries(publicComponents))(
    'exports %s as a defined public component',
    (_name, component) => {
      expect(component).toBeDefined();
      expect(
        typeof component === 'function' ||
          (typeof component === 'object' && component !== null),
      ).toBe(true);
    },
  );

  it('exports the form validation helpers', () => {
    expect(FORM_LEVEL_ERROR_KEY).toBe('_form');
    expect(validationErrorToFormErrors).toBeTypeOf('function');
    expect(validationIssuesToFormErrors).toBeTypeOf('function');
    expect(validationResultToFormErrors).toBeTypeOf('function');
  });
});
