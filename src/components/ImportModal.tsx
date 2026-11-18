'use client';

import { DownloadOutlined, FileExcelOutlined, InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Modal, Result, Space, Steps, Table, Tag, Typography, Upload } from 'antd';
import { useMemo, useState } from 'react';
import { downloadImportTemplate } from '@/lib/exportTodos';
import { IMPORT_ACCEPT, MAX_IMPORT_BYTES, parseImportFile, type ImportResult, type ImportRow } from '@/lib/importTodos';
import { parseCategory } from '@/lib/todo';
import { bulkAddTodos, duplicateKey } from '@/lib/todoRepository';
import type { Todo } from '@/lib/todo';
import { CategoryTag } from './TaskBits';

interface Props {
  open: boolean;
  existing: readonly Todo[];
  onClose: () => void;
}

type Step = 0 | 1 | 2;

export default function ImportModal({ open, existing, onClose }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [file, setFile] = useState<{ name: string; size: number }>();
  const [result, setResult] = useState<ImportResult>();
  const [uploadError, setUploadError] = useState<string>();
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [saveError, setSaveError] = useState<string>();

  const counts = useMemo(() => {
    const rows = result?.rows ?? [];
    return {
      valid: rows.filter((r) => r.status === 'valid').length,
      duplicate: rows.filter((r) => r.status === 'duplicate').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
    };
  }, [result]);
  const toImport = counts.valid + (skipDuplicates ? 0 : counts.duplicate);

  function reset() {
    setStep(0);
    setFile(undefined);
    setResult(undefined);
    setUploadError(undefined);
    setSaveError(undefined);
    setImported(0);
    setSkipDuplicates(true);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleFile(f: File) {
    setUploadError(undefined);
    if (f.size > MAX_IMPORT_BYTES) {
      setUploadError('This file is larger than 5 MB.');
      return;
    }
    const ext = f.name.toLowerCase().split('.').pop();
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setUploadError('Please choose a .csv, .xlsx or .xls file.');
      return;
    }
    const data = await f.arrayBuffer();
    const keys = new Set(existing.map(duplicateKey));
    const parsed = parseImportFile(data, f.name, keys, duplicateKey);
    if (parsed.fileError) {
      setUploadError(parsed.fileError);
      return;
    }
    setFile({ name: f.name, size: f.size });
    setResult(parsed);
    setStep(1);
  }

  async function handleImport() {
    if (!result) return;
    const inputs = result.rows
      .filter((r) => r.status === 'valid' || (!skipDuplicates && r.status === 'duplicate'))
      .map((r) => r.input!)
      .filter(Boolean);
    setImporting(true);
    setSaveError(undefined);
    try {
      const n = await bulkAddTodos(inputs);
      setImported(n);
      setStep(2);
    } catch (err) {
      setSaveError(`Nothing was imported: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  const columns = [
    { title: 'Row', dataIndex: 'rowNumber', width: 64 },
    { title: 'Title', key: 'title', render: (_: unknown, r: ImportRow) => r.display.title || <Typography.Text type="secondary">(empty)</Typography.Text> },
    {
      title: 'Category',
      key: 'category',
      width: 120,
      render: (_: unknown, r: ImportRow) => {
        const c = parseCategory(r.display.category);
        return c ? <CategoryTag category={c} /> : <Typography.Text type="danger">{r.display.category || '—'}</Typography.Text>;
      },
    },
    { title: 'Due date', key: 'due', width: 120, render: (_: unknown, r: ImportRow) => r.display.dueDate || '—' },
    { title: 'Time', key: 'time', width: 80, render: (_: unknown, r: ImportRow) => r.display.dueTime || '—' },
    { title: 'Status', key: 'done', width: 80, render: (_: unknown, r: ImportRow) => r.display.completed },
    {
      title: 'Result',
      key: 'result',
      width: 260,
      render: (_: unknown, r: ImportRow) => {
        if (r.status === 'valid') return <Typography.Text type="success">Ready</Typography.Text>;
        if (r.status === 'duplicate') {
          return <Typography.Text type="warning">{skipDuplicates ? 'Already exists — will be skipped' : 'Already exists — will be added again'}</Typography.Text>;
        }
        return <Typography.Text type="danger">{r.errors.join('; ')}</Typography.Text>;
      },
    },
  ];

  const footer =
    step === 0 ? (
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button icon={<DownloadOutlined />} type="link" onClick={downloadImportTemplate} style={{ paddingInline: 0 }}>
          Download template (.xlsx)
        </Button>
        <Button onClick={close}>Cancel</Button>
      </Space>
    ) : step === 1 ? (
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Button icon={<DownloadOutlined />} type="link" onClick={downloadImportTemplate} style={{ paddingInline: 0 }}>
          Download template (.xlsx)
        </Button>
        <Space>
          <Button onClick={close}>Cancel</Button>
          <Button type="primary" disabled={toImport === 0} loading={importing} onClick={handleImport}>
            Import {toImport} {toImport === 1 ? 'task' : 'tasks'}
          </Button>
        </Space>
      </Space>
    ) : (
      <Button type="primary" onClick={close}>
        Done
      </Button>
    );

  return (
    <Modal open={open} title="Import tasks from CSV or Excel" onCancel={close} footer={footer} width={920} destroyOnHidden>
      <Steps
        current={step}
        size="small"
        style={{ margin: '16px 0 20px' }}
        items={[{ title: 'Upload file' }, { title: 'Review rows' }, { title: 'Done' }]}
      />

      {step === 0 && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Upload.Dragger
            accept={IMPORT_ACCEPT}
            multiple={false}
            showUploadList={false}
            beforeUpload={(f) => {
              void handleFile(f);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag a file here</p>
            <p className="ant-upload-hint">CSV, XLSX or XLS, up to 5 MB. Columns: Title, Description, Category, Due Date, Completed.</p>
          </Upload.Dragger>
          {uploadError && <Alert type="error" showIcon title={uploadError} />}
        </Space>
      )}

      {step === 1 && result && file && (
        <Space orientation="vertical" size={14} style={{ width: '100%' }}>
          <Space align="center" size={12} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '10px 14px', width: '100%', background: '#fafafa' }}>
            <FileExcelOutlined style={{ fontSize: 24, color: '#237804' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{file.name}</div>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Sheet “{result.sheetName}” · {result.rows.length} rows · {Math.max(1, Math.round(file.size / 1024))} KB
              </Typography.Text>
            </div>
            <Button type="link" onClick={reset}>
              Replace file
            </Button>
          </Space>
          <Space wrap>
            <Tag color="success">{counts.valid} ready to import</Tag>
            {counts.duplicate > 0 && <Tag color="warning">{counts.duplicate} {counts.duplicate === 1 ? 'duplicate' : 'duplicates'}</Tag>}
            {counts.invalid > 0 && (
              <Tag color="error">
                {counts.invalid} {counts.invalid === 1 ? 'row' : 'rows'} with errors (will be skipped)
              </Tag>
            )}
          </Space>
          <Table<ImportRow>
            size="small"
            rowKey="rowNumber"
            columns={columns}
            dataSource={result.rows}
            pagination={result.rows.length > 50 ? { pageSize: 50, showSizeChanger: false } : false}
            scroll={{ y: 320, x: 760 }}
            rowClassName={(r) => (r.status === 'invalid' ? 'import-row-invalid' : r.status === 'duplicate' ? 'import-row-duplicate' : '')}
          />
          {counts.duplicate > 0 && (
            <Checkbox checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)}>
              Skip tasks that already exist (same title and due date)
            </Checkbox>
          )}
          {saveError && <Alert type="error" showIcon title={saveError} />}
        </Space>
      )}

      {step === 2 && (
        <Result status="success" title={`Imported ${imported} ${imported === 1 ? 'task' : 'tasks'}`} subTitle="They were added to the end of your list." />
      )}
    </Modal>
  );
}
