import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@context/ThemeContext';
import { PricePoint } from '@/types/crypto';

interface LineChartProps {
  data: PricePoint[];
  width: number;
  height: number;
  positive: boolean;
}

const STROKE_WIDTH = 2.5;
const GRADIENT_ID = 'priceGradient';

function buildPaths(data: PricePoint[], width: number, height: number) {
  const prices = data.map((point) => point.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((point.price - minPrice) / priceRange) * height;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return { linePath, areaPath };
}

export function LineChart({ data, width, height, positive }: LineChartProps) {
  const { colors } = useTheme();
  const { linePath, areaPath } = buildPaths(data, width, height);
  const lineColor = positive ? colors.positive : colors.negative;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lineColor} stopOpacity={0.3} />
          <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill={`url(#${GRADIENT_ID})`} />
      <Path d={linePath} stroke={lineColor} strokeWidth={STROKE_WIDTH} fill="none" />
    </Svg>
  );
}
