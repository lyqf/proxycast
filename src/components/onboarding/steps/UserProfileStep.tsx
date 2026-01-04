/**
 * 初次安装引导 - 用户群体选择
 */

import styled from "styled-components";
import { Check } from "lucide-react";
import { userProfiles, type UserProfile } from "../constants";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 8px;
  text-align: center;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  margin-bottom: 32px;
  text-align: center;
`;

const ProfileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  width: 100%;
  max-width: 500px;
`;

const ProfileCard = styled.button<{ $selected?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  border-radius: 12px;
  border: 2px solid
    ${({ $selected }) =>
      $selected ? "hsl(var(--primary))" : "hsl(var(--border))"};
  background: ${({ $selected }) =>
    $selected ? "hsl(var(--primary) / 0.05)" : "hsl(var(--card))"};
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    border-color: ${({ $selected }) =>
      $selected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)"};
  }
`;

const CheckBadge = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: hsl(var(--primary));
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 14px;
    height: 14px;
    color: hsl(var(--primary-foreground));
  }
`;

const IconWrapper = styled.div<{ $selected?: boolean }>`
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: ${({ $selected }) =>
    $selected ? "hsl(var(--primary))" : "hsl(var(--muted))"};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  transition: all 0.2s;

  svg {
    width: 28px;
    height: 28px;
    color: ${({ $selected }) =>
      $selected ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"};
  }
`;

const ProfileName = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 8px;
`;

const ProfileDescription = styled.span`
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-align: center;
  line-height: 1.5;
`;

interface UserProfileStepProps {
  selectedProfile: UserProfile | null;
  onSelect: (profile: UserProfile) => void;
}

export function UserProfileStep({
  selectedProfile,
  onSelect,
}: UserProfileStepProps) {
  return (
    <Container>
      <Title>您是哪类用户？</Title>
      <Subtitle>我们将根据您的选择推荐合适的插件</Subtitle>

      <ProfileGrid>
        {userProfiles.map((profile) => {
          const isSelected = selectedProfile === profile.id;
          const Icon = profile.icon;

          return (
            <ProfileCard
              key={profile.id}
              $selected={isSelected}
              onClick={() => onSelect(profile.id)}
            >
              {isSelected && (
                <CheckBadge>
                  <Check />
                </CheckBadge>
              )}
              <IconWrapper $selected={isSelected}>
                <Icon />
              </IconWrapper>
              <ProfileName>{profile.name}</ProfileName>
              <ProfileDescription>{profile.description}</ProfileDescription>
            </ProfileCard>
          );
        })}
      </ProfileGrid>
    </Container>
  );
}
