import type { SaveStudyLogOutput } from '../../shared/dto';

export function feedbackMessage(result: SaveStudyLogOutput): string {
  if (result.feedback_kind === 'completed') {
    return '已记录本次学习，资料已参悟完成。';
  }
  if (result.feedback_kind === 'unchanged') {
    return '已记录本次学习，本次暂无进度变化。';
  }
  if (result.feedback_kind === 'decreased') {
    return `已记录本次学习，进度调整为 ${result.resource.progress_percent}%。`;
  }
  return `已记录本次学习，进度提升 ${result.progress_delta}%。`;
}
