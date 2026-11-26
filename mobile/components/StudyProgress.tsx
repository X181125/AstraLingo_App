import React from 'react';
import { Copy, Panel, Pending, Section, useFocusedData } from './Learning';
import { skillName, type Skill } from '../src/learning';

type Progress = {
  attempts: number; completedQuizzes: number; reviewedCards: number; streak: number; recentDays: string[];
  skills: { skill: Skill; graded: number; average: number | null }[];
};
export function StudyProgress() {
  const progress = useFocusedData<Progress>('/account/progress');
  const data = progress.data;
  return <Section title="Tiến độ học">
    <Pending {...progress} />
    {data && <Panel>
      <Copy>{data.streak} ngày liên tiếp · {data.attempts} bài đã nộp</Copy>
      <Copy>{data.completedQuizzes} lượt Quiz/Exam · {data.reviewedCards} thẻ đã ôn</Copy>
      {data.skills.map(item => <Copy key={item.skill}>{skillName[item.skill]} · {item.average === null ? 'Chưa có điểm' : `${item.average}/100 qua ${item.graded} lượt`}</Copy>)}
      {!!data.recentDays.length && <Copy>Ngày học gần đây {data.recentDays.join(' · ')}</Copy>}
    </Panel>}
  </Section>;
}
