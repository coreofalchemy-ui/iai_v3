/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="w-full text-left">
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">
        신발 이미지 AI 에디터
      </h1>
      <p className="mt-4 text-lg text-zinc-600">
        AI를 사용하여 신발 제품 사진을 전문가 수준으로 손쉽게 편집하세요.
      </p>
    </header>
  );
};

export default Header;