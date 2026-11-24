
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
    expect(Object.keys(publicComponents)).toHaveLength(30);
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
