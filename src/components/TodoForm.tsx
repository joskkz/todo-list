'use client';

import { Button, DatePicker, Form, Input, Radio, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { ISO_DATE, TIME_FORMAT } from '@/lib/dates';
import { CATEGORIES, CATEGORY_META, type Category, type Todo } from '@/lib/todo';
import { CategoryDot } from './TaskBits';

export interface TodoFormValues {
  title: string;
  description?: string;
  category: Category;
  dueDate?: string;
  dueTime?: string;
}

interface FormFields {
  title: string;
  description?: string;
  category: Category;
  dueDate?: Dayjs | null;
  dueTime?: Dayjs | null;
}


interface Props {
  /** When set, the form edits this task; otherwise it adds a new one. */
  editing?: Todo;
  /** Pre-filled due date for new tasks (e.g. from the calendar). */
  defaultDueDate?: string;
  onCancel: () => void;
  onSubmit: (values: TodoFormValues) => Promise<void>;
}

/** Fields shared by the add and edit dialogs. */
export default function TodoForm({ editing, defaultDueDate, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm<FormFields>();
  const [saving, setSaving] = useState(false);

  const initialValues: FormFields = editing
    ? {
        title: editing.title,
        description: editing.description,
        category: editing.category,
        dueDate: editing.dueDate ? dayjs(editing.dueDate) : null,
        dueTime: editing.dueTime ? dayjs(editing.dueTime, TIME_FORMAT) : null,
      }
    : { title: '', description: '', category: 'work', dueDate: defaultDueDate ? dayjs(defaultDueDate) : null, dueTime: null };

  async function handleFinish(values: FormFields) {
    setSaving(true);
    try {
      await onSubmit({
        title: values.title,
        description: values.description,
        category: values.category,
        dueDate: values.dueDate ? values.dueDate.format(ISO_DATE) : undefined,
        dueTime: values.dueTime ? values.dueTime.format(TIME_FORMAT) : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form form={form} layout="vertical" requiredMark="optional" initialValues={initialValues} onFinish={handleFinish} style={{ marginTop: 16 }}>
      <Form.Item
        name="title"
        label="Title"
        rules={[
          { required: true, whitespace: true, message: 'Please enter a title.' },
          { max: 200, message: 'Title must be 200 characters or fewer.' },
        ]}
      >
        <Input placeholder="e.g. Prepare Q4 report" maxLength={200} autoFocus />
      </Form.Item>
      <Form.Item name="description" label="Description" rules={[{ max: 2000 }]}>
        <Input.TextArea placeholder="Optional details" autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} />
      </Form.Item>
      <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please choose a category.' }]}>
        <Radio.Group optionType="button" buttonStyle="outline" style={{ display: 'flex', width: '100%' }}>
          {CATEGORIES.map((c) => (
            <Radio.Button key={c} value={c} style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <CategoryDot category={c} />
                {CATEGORY_META[c].label}
              </span>
            </Radio.Button>
          ))}
        </Radio.Group>
      </Form.Item>
      <Form.Item name="dueDate" label="Due date">
        <DatePicker format="D MMM YYYY" style={{ width: 220 }} placeholder="No due date" />
      </Form.Item>
      <Form.Item name="dueTime" label="Time">
        <TimePicker format={TIME_FORMAT} minuteStep={5} needConfirm={false} style={{ width: 220 }} placeholder="No time" />
      </Form.Item>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={saving}>
          {editing ? 'Save changes' : 'Add task'}
        </Button>
      </div>
    </Form>
  );
}
