import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect, G } from 'react-native-svg';

export function Artwork({ kind = 'planet', size = 150, dark = false }: { kind?: string; size?: number; dark?: boolean }) {
  const purple = dark ? '#D8C9FF' : '#8970D9';
  return <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityElementsHidden>
    <Circle cx="98" cy="103" r="76" fill={dark ? '#FFFFFF' : '#FFFFFF'} opacity={dark ? .07 : .35} />
    <Path d="M31 39v12M25 45h12M162 143v14M155 150h14" stroke={purple} strokeWidth="3" strokeLinecap="round" />
    <Circle cx="158" cy="39" r="4" fill="#F3BD70" /><Circle cx="38" cy="155" r="3" fill={purple} />
    {kind === 'planet' && <G rotation="-22" origin="100,100">
      <Circle cx="102" cy="97" r="46" fill={dark ? '#E6DFFC' : '#B19AE9'} />
      <Path d="M66 69c23 20 46 16 69 1M58 91c20 22 53 22 86 4M66 119c25 17 49 12 70 3" stroke={dark ? '#C1ADEE' : '#9577D2'} strokeWidth="8" fill="none" opacity=".65" />
      <Ellipse cx="100" cy="104" rx="78" ry="21" stroke="#F6C473" strokeWidth="12" fill="none" />
      <Path d="M60 91c-8-37 38-59 68-28 7 7 12 15 14 24" fill={dark ? '#E6DFFC' : '#B19AE9'} />
      <Circle cx="92" cy="78" r="5" fill="#FFF7E6" opacity=".7" />
    </G>}
    {kind === 'chat' && <G rotation="-9" origin="100,100">
      <Path d="M45 55h84a18 18 0 0118 18v36a18 18 0 01-18 18H88l-28 23v-23H45a18 18 0 01-18-18V73a18 18 0 0118-18" fill="#DC916D" />
      <Path d="M99 94h55a15 15 0 0115 15v28a15 15 0 01-15 15v17l-23-17H99a15 15 0 01-15-15v-28a15 15 0 0115-15" fill="#FFF9ED" />
      <Circle cx="59" cy="90" r="5" fill="white" /><Circle cx="81" cy="90" r="5" fill="white" /><Circle cx="103" cy="90" r="5" fill="white" />
      <Path d="M107 121h38M107 134h25" stroke="#D9B49A" strokeWidth="5" strokeLinecap="round" />
    </G>}
    {kind === 'book' && <G rotation="-12" origin="100,100">
      <Rect x="53" y="42" width="95" height="123" rx="12" fill="#4E8E72" />
      <Rect x="63" y="42" width="85" height="112" rx="7" fill="#7DB79B" />
      <Path d="M68 156h71M83 78h42M83 91h28" stroke="#F6F8DF" strokeWidth="5" strokeLinecap="round" />
      <Path d="M115 42v26l10-6 10 6V42" fill="#F1C572" /><Circle cx="99" cy="124" r="14" fill="#D9EAD3" />
    </G>}
    {kind === 'headphones' && <G>
      <Path d="M51 108V94a49 49 0 0198 0v14" fill="none" stroke="#D9A350" strokeWidth="14" strokeLinecap="round" />
      <Rect x="40" y="98" width="29" height="50" rx="14" fill="#8066BE" /><Rect x="133" y="98" width="29" height="50" rx="14" fill="#8066BE" />
      <Path d="M87 99v37M101 89v58M115 103v29" stroke="#D9A350" strokeWidth="6" strokeLinecap="round" />
    </G>}
    {kind === 'pencil' && <G rotation="30" origin="100,100">
      <Rect x="80" y="35" width="37" height="105" rx="7" fill="#729AD2" /><Rect x="80" y="35" width="37" height="24" rx="5" fill="#C7B1E8" />
      <Path d="M80 140l19 34 18-34" fill="#F2CF91" /><Path d="M92 162l7 12 7-12" fill="#45415B" /><Path d="M91 66v64" stroke="#B6D2F8" strokeWidth="6" />
    </G>}
    {kind === 'mail' && <G rotation="-9" origin="100,100">
      <Rect x="38" y="65" width="124" height="85" rx="14" fill="#B7A0E8" />
      <Path d="M40 73l60 43 60-43" fill="#E8DFF8" stroke="#F8F5FF" strokeWidth="4" strokeLinejoin="round" />
      <Circle cx="150" cy="60" r="25" fill="#7BA58A" /><Path d="M138 60l8 8 16-17" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" />
    </G>}
  </Svg>;
}
