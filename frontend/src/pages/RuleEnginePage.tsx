import { useState } from 'react'
import {
  Stack, Typography, Card, CardContent, Button, Switch, Box,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, IconButton, Chip,
  FormControl, InputLabel,
} from '@mui/material'
import { useRuleEngineStore } from '../stores/useRuleEngineStore'
import { useGeofenceStore } from '../stores/useGeofenceStore'
import type {
  AutomationRule, RuleCondition, RuleAction,
  RuleSignal, RuleOperator, RuleActionType,
} from '../types'

const SIGNALS: { value: RuleSignal; label: string }[] = [
  { value: 'riskLevel', label: '风险等级' },
  { value: 'tripStatus', label: '行程状态' },
  { value: 'tripOvertimeMinutes', label: '行程超时(分钟)' },
  { value: 'geofenceEvent', label: '围栏事件' },
  { value: 'stationaryMinutes', label: '静止时长(分钟)' },
]

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'eq', label: '等于' },
  { value: 'gte', label: '≥' },
  { value: 'gt', label: '>' },
]

const RISK_LEVELS = ['ok', 'attention', 'warning']
const TRIP_STATUSES = ['active', 'overtime', 'arrived', 'cancelled']
const TRIP_OVERTIME_VALUES = ['5', '10', '15', '30']
const STATIONARY_VALUES = ['30', '60', '120']

const ACTION_TYPES: { value: RuleActionType; label: string }[] = [
  { value: 'localNotification', label: '本地通知' },
  { value: 'preArmSos', label: '预置 SOS' },
]

const COOLDOWNS = [1, 5, 15, 30, 60]

function signalValues(signal: RuleSignal, geofenceNames: string[]): string[] {
  switch (signal) {
    case 'riskLevel': return RISK_LEVELS
    case 'tripStatus': return TRIP_STATUSES
    case 'tripOvertimeMinutes': return TRIP_OVERTIME_VALUES
    case 'stationaryMinutes': return STATIONARY_VALUES
    case 'geofenceEvent':
      return geofenceNames.flatMap((n) => [`entered:${n}`, `left:${n}`])
  }
}

function buildConditionLabel(signal: RuleSignal, op: RuleOperator, value: string): string {
  const sigLabel = SIGNALS.find((s) => s.value === signal)?.label ?? signal
  const opLabel = OPERATORS.find((o) => o.value === op)?.label ?? op
  return `${sigLabel} ${opLabel} ${value}`
}

function blankCondition(): RuleCondition {
  return { signal: 'riskLevel', operator: 'gte', value: 'attention', label: '' }
}

function blankAction(): RuleAction {
  return { type: 'localNotification', config: { title: '规则提醒', body: '' }, label: '' }
}

export function RuleEnginePage() {
  const rules = useRuleEngineStore((s) => s.rules)
  const addRule = useRuleEngineStore((s) => s.addRule)
  const updateRule = useRuleEngineStore((s) => s.updateRule)
  const deleteRule = useRuleEngineStore((s) => s.deleteRule)

  const geofenceZones = useGeofenceStore((s) => s.zones)
  const geofenceNames = geofenceZones.map((z) => z.label)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [conditions, setConditions] = useState<RuleCondition[]>([blankCondition()])
  const [actions, setActions] = useState<RuleAction[]>([blankAction()])
  const [cooldown, setCooldown] = useState<number>(5)

  const openCreate = () => {
    setEditingId(null)
    setName('')
    setConditions([blankCondition()])
    setActions([blankAction()])
    setCooldown(5)
    setDialogOpen(true)
  }

  const openEdit = (rule: AutomationRule) => {
    setEditingId(rule.id)
    setName(rule.name)
    setConditions(rule.conditions.length > 0 ? [...rule.conditions] : [blankCondition()])
    setActions(rule.actions.length > 0 ? [...rule.actions] : [blankAction()])
    setCooldown(rule.cooldownMinutes)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingId(null)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const labelledConditions: RuleCondition[] = conditions.map((c) => ({
      ...c,
      label: buildConditionLabel(c.signal, c.operator, String(c.value)),
    }))
    const labelledActions: RuleAction[] = actions.map((a) => ({
      ...a,
      label: a.type === 'localNotification' ? '本地通知' : '预置 SOS',
    }))

    if (editingId) {
      await updateRule(editingId, {
        name: name.trim(),
        conditions: labelledConditions,
        actions: labelledActions,
        cooldownMinutes: cooldown,
      })
    } else {
      await addRule({
        name: name.trim(),
        enabled: true,
        conditions: labelledConditions,
        actions: labelledActions,
        cooldownMinutes: cooldown,
      })
    }
    closeDialog()
  }

  const handleDelete = async () => {
    if (editingId) {
      await deleteRule(editingId)
      closeDialog()
    }
  }

  const addCondition = () => setConditions([...conditions, blankCondition()])
  const removeCondition = (i: number) => {
    if (conditions.length <= 1) return
    setConditions(conditions.filter((_, idx) => idx !== i))
  }
  const updateCondition = (i: number, patch: Partial<RuleCondition>) => {
    setConditions(conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  }

  const addAction = () => setActions([...actions, blankAction()])
  const removeAction = (i: number) => {
    if (actions.length <= 1) return
    setActions(actions.filter((_, idx) => idx !== i))
  }
  const updateAction = (i: number, patch: Partial<RuleAction>) => {
    setActions(actions.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">智能规则</Typography>
        <Button variant="contained" onClick={openCreate}>创建规则</Button>
      </Stack>

      {rules.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              暂无智能规则
            </Typography>
            <Typography variant="body2" color="text.secondary">
              创建一条规则，让应用在满足条件时自动提醒你
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {rules.map((rule) => (
            <Card
              key={rule.id}
              variant="outlined"
              sx={{ borderRadius: 3, cursor: 'pointer' }}
              onClick={() => openEdit(rule)}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={600}>{rule.name}</Typography>
                  <Switch
                    checked={rule.enabled}
                    onChange={(e) => {
                      e.stopPropagation()
                      useRuleEngineStore.getState().setEnabled(rule.id, e.target.checked)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Stack>
                <Stack spacing={0.5} mt={0.5}>
                  {rule.conditions.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {rule.conditions.map((c, i) => (
                        <Chip key={i} label={c.label} size="small" variant="outlined" color="primary" />
                      ))}
                    </Box>
                  )}
                  {rule.actions.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {rule.actions.map((a, i) => (
                        <Chip key={i} label={a.label} size="small" variant="outlined" color="secondary" />
                      ))}
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? '编辑智能规则' : '新建智能规则'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="规则名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
            />

            {conditions.map((cond, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>信号</InputLabel>
                  <Select
                    value={cond.signal}
                    label="信号"
                    onChange={(e) => {
                      const sig = e.target.value as RuleSignal
                      const values = signalValues(sig, geofenceNames)
                      updateCondition(i, { signal: sig, value: values[0] ?? '' })
                    }}
                  >
                    {SIGNALS.map((s) => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 90 }}>
                  <InputLabel>运算符</InputLabel>
                  <Select
                    value={cond.operator}
                    label="运算符"
                    onChange={(e) => updateCondition(i, { operator: e.target.value as RuleOperator })}
                  >
                    {OPERATORS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>值</InputLabel>
                  <Select
                    value={String(cond.value)}
                    label="值"
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                  >
                    {signalValues(cond.signal, geofenceNames).map((v) => (
                      <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {conditions.length > 1 && (
                  <IconButton size="small" color="error" onClick={() => removeCondition(i)}>
                    <span aria-hidden>✕</span>
                  </IconButton>
                )}
              </Stack>
            ))}
            <Button size="small" variant="outlined" onClick={addCondition}>
              + 添加条件
            </Button>

            {actions.map((action, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>动作</InputLabel>
                  <Select
                    value={action.type}
                    label="动作"
                    onChange={(e) => updateAction(i, { type: e.target.value as RuleActionType })}
                  >
                    {ACTION_TYPES.map((a) => (
                      <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {action.type === 'localNotification' && (
                  <TextField
                    label="通知内容"
                    value={action.config.body ?? ''}
                    onChange={(e) => updateAction(i, { config: { ...action.config, body: e.target.value } })}
                    size="small"
                    fullWidth
                  />
                )}
                {action.type === 'preArmSos' && (
                  <TextField
                    label="延时(秒)"
                    value={action.config.delaySeconds ?? '0'}
                    onChange={(e) => updateAction(i, { config: { ...action.config, delaySeconds: e.target.value } })}
                    size="small"
                    sx={{ maxWidth: 120 }}
                  />
                )}
                {actions.length > 1 && (
                  <IconButton size="small" color="error" onClick={() => removeAction(i)}>
                    <span aria-hidden>✕</span>
                  </IconButton>
                )}
              </Stack>
            ))}
            <Button size="small" variant="outlined" onClick={addAction}>
              + 添加动作
            </Button>

            <FormControl size="small" sx={{ maxWidth: 160 }}>
              <InputLabel>冷却时间(分钟)</InputLabel>
              <Select
                value={String(cooldown)}
                label="冷却时间(分钟)"
                onChange={(e) => setCooldown(Number(e.target.value))}
              >
                {COOLDOWNS.map((v) => (
                  <MenuItem key={v} value={String(v)}>{v} 分钟</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          {editingId && (
            <Button onClick={handleDelete} color="error" sx={{ mr: 'auto' }}>
              删除
            </Button>
          )}
          <Button onClick={closeDialog}>取消</Button>
          <Button onClick={handleSave} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
