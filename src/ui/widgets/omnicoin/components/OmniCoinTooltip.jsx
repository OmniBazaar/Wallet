import React, { useState } from 'react';
import styled from 'styled-components';

const TooltipContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const TooltipTrigger = styled.div`
  cursor: help;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e0e0e0;
  color: #666;
  font-size: 12px;
  margin-left: 4px;
  
  &:hover {
    background: #d0d0d0;
  }
`;

const TooltipContent = styled.div`
  position: absolute;
  z-index: 1000;
  background: #333;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  width: max-content;
  max-width: 200px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  
  ${props => {
        switch (props.position) {
            case 'top':
                return `
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          &:after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-width: 4px;
            border-style: solid;
            border-color: #333 transparent transparent transparent;
          }
        `;
            case 'bottom':
                return `
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 8px;
          &:after {
            content: '';
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-width: 4px;
            border-style: solid;
            border-color: transparent transparent #333 transparent;
          }
        `;
            case 'left':
                return `
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-right: 8px;
          &:after {
            content: '';
            position: absolute;
            left: 100%;
            top: 50%;
            transform: translateY(-50%);
            border-width: 4px;
            border-style: solid;
            border-color: transparent transparent transparent #333;
          }
        `;
            case 'right':
                return `
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 8px;
          &:after {
            content: '';
            position: absolute;
            right: 100%;
            top: 50%;
            transform: translateY(-50%);
            border-width: 4px;
            border-style: solid;
            border-color: transparent #333 transparent transparent;
          }
        `;
            default:
                return '';
        }
    }}
`;

const OmniCoinTooltip = ({
    text,
    children,
    position = 'top',
    trigger = '?'
}) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <TooltipContainer
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children || <TooltipTrigger>{trigger}</TooltipTrigger>}
            {isVisible && (
                <TooltipContent position={position}>
                    {text}
                </TooltipContent>
            )}
        </TooltipContainer>
    );
};

export default OmniCoinTooltip; 