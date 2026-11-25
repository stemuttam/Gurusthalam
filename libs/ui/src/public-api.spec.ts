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
  Input,
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
  List,
  ListItem,
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
    Input,
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
    List,
    ListItem,
  };

  it('exports every currently supported public component', () => {
    expect(Object.keys(publicComponents)).toHaveLength(33);
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
});
