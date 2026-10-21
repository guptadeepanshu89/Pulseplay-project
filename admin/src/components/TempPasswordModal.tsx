import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Typography } from 'antd';
import { useState } from 'react';

const { Text, Paragraph } = Typography;

interface Props {
  open: boolean;
  title: string;
  identifierLabel: string;
  identifier: string;
  password: string | null;
  onClose: () => void;
}

// Shown exactly once, right after create/reset — the server never returns this
// value again (SC-05), so this is the only chance to hand it to the person.
export function TempPasswordModal({ open, title, identifierLabel, identifier, password, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open={open} title={title} onCancel={onClose} footer={<Button type="primary" onClick={onClose}>Done</Button>} maskClosable={false}>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="This password is shown only once"
        description="Copy it now and share it with the person securely — it cannot be viewed again. They must change it at first sign-in."
      />
      <Paragraph>
        <Text type="secondary">{identifierLabel}: </Text>
        <Text strong>{identifier}</Text>
      </Paragraph>
      <Paragraph>
        <Text type="secondary">Temporary password: </Text>
        <Text strong code copyable={false} className="pp-temp-password">
          {password}
        </Text>
        <Button
          size="small"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={copy}
          style={{ marginLeft: 8 }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Paragraph>
    </Modal>
  );
}
