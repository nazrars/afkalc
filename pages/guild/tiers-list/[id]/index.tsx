import { GetStaticPaths } from "next";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useContext, useEffect, useState } from "react";
import useFirestoreDocument from "../../../../components/hooks/useFirestoreDocument";
import useFirestoreDocumentReference from "../../../../components/hooks/useFirestoreDocumentReference";
import withLayoutPrivate from "../../../../components/layout/withLayoutPrivate";
import BackTiersList from "../../../../components/pages/Guild/ui/BackTiersList";
import CharacterTiersList from "../../../../components/pages/Guild/ui/CharacterTiersList";
import TiersListItem from "../../../../components/pages/Guild/ui/TiersListItem";
import GuildContext from "../../../../components/providers/GuildContext";
import IFirebasePriorityList from "../../../../components/providers/types/IFirebasePriorityList";
import IFirebaseProfile from "../../../../components/providers/types/IFirebaseProfile";
import Card from "../../../../components/ui/card/Card";
import CardAction from "../../../../components/ui/card/CardAction";
import CardActions from "../../../../components/ui/card/CardActions";
import CardTitle from "../../../../components/ui/card/CardTitle";
import heroes from "../../../../data/heroes.json";
import { isValidList, isValidSelf } from "../../../../lib/tiersList";
import ICharacter from "../../../../types/ICharacter";

const typedHeroes: ICharacter[] = heroes as ICharacter[];

export const getStaticProps = async ({ locale }: { locale: string }) => ({
  props: {
    ...(await serverSideTranslations(locale, ["common", "guild", "priority-list"])),
  },
});

export const getStaticPaths: GetStaticPaths<{ slug: string }> = async () => ({
  paths: [],
  fallback: "blocking",
});

enum Sort {
  Name,
  LastUpdate,
  Percentage,
}

interface IProps {
  [key: string]: never;
}

const TiersList: React.FC<IProps> = function TiersList() {
  const router = useRouter();
  const { t } = useTranslation("priority-list");
  const { values: guildValues, actions: guildActions } = useContext(GuildContext);
  const { id } = router.query;

  const [sort, setSort] = useState(Sort.Name);
  const document = useFirestoreDocumentReference(`priority-list/${id}`);
  const result = useFirestoreDocument<IFirebasePriorityList>(document);

  useEffect(() => guildActions.load(), [guildActions]);

  if (
    document === undefined ||
    result.status !== "success" ||
    result.data === undefined ||
    result.data === null
  ) {
    return null;
  }

  if (result.data === undefined) return null;

  const list = result.data;

  const guildMembers = guildValues.members
    .map((member) => {
      let firstKo: number = 0;
      let totalKoCount = 0;

      list.heroes.forEach((hero, i) => {
        const isHeroValidList = isValidList(list, hero, member.heroes?.[hero.hero]);
        const isHeroValidSelf = isValidSelf(hero, member.heroes?.[hero.hero]);

        const hasSelfRequirements =
          [0, undefined].includes(hero.ascend) === false ||
          [-1, 0, undefined].includes(hero.si) === false ||
          [0, undefined].includes(hero.fi) === false ||
          [0, undefined].includes(hero.engrave) === false;

        const isDone = isHeroValidList && (isHeroValidSelf || hasSelfRequirements === false);

        if (isDone === false) {
          totalKoCount += 1;

          if (firstKo === 0) {
            firstKo = hero.hero;
          }
        }
      });

      return {
        id: member.id,
        playerName: member.playerName,
        heroesLastUpdate: member.heroesLastUpdate,
        percentage: (100 * (list.heroes.length - totalKoCount)) / list.heroes.length,
        firstKoHero: typedHeroes.find((hero) => hero.id === firstKo)?.name ?? "",
      };
    })
    .sort((playerA, playerB) => {
      if (sort === Sort.Percentage) {
        return playerA.percentage < playerB.percentage ? 1 : -1;
      }
      if (sort === Sort.LastUpdate) {
        const lastUpdateA = playerA.heroesLastUpdate
          ? new Date(playerA.heroesLastUpdate)
          : new Date(0);
        const lastUpdateB = playerB.heroesLastUpdate
          ? new Date(playerB.heroesLastUpdate)
          : new Date(0);

        return lastUpdateA < lastUpdateB ? -1 : 1;
      }

      const playerNameA = playerA.playerName || "";
      const playerNameB = playerB.playerName || "";

      return playerNameA.localeCompare(playerNameB);
    });

  return (
    <>
      <Head>
        <title>{`${t("common:menu.priority-list")} - Afkalc`}</title>
        <meta name="description" content="" />
      </Head>

      <BackTiersList id={id as string} />

      <Card>
        <CardTitle>{result.data.title}</CardTitle>
        <div style={{ display: "flex", gap: "16px", padding: "16px", flexWrap: "wrap" }}>
          {result.data.heroes.map((hero) => {
            let totalOkCount = 0;
            const koPlayers: IFirebaseProfile[] = [];
            const okPlayers: IFirebaseProfile[] = [];

            guildValues.members.forEach((member) => {
              const isHeroValidList = isValidList(list, hero, member.heroes?.[hero.hero]);
              const isHeroValidSelf = isValidSelf(hero, member.heroes?.[hero.hero]);

              const hasSelfRequirements =
                [0, undefined].includes(hero.ascend) === false ||
                [-1, 0, undefined].includes(hero.si) === false ||
                [0, undefined].includes(hero.fi) === false ||
                [0, undefined].includes(hero.engrave) === false;

              const isDone = isHeroValidList && (isHeroValidSelf || hasSelfRequirements === false);

              if (isDone) {
                totalOkCount += 1;
                okPlayers.push(member);
              } else if (member.playerName) {
                koPlayers.push(member);
              }
            });

            return (
              <CharacterTiersList
                hero={hero}
                percentage={(100 * totalOkCount) / guildValues.members.length}
                koPlayers={koPlayers}
                okPlayers={okPlayers}
              />
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>{guildValues.guild.name}</CardTitle>
        <CardActions>
          <CardAction onClick={() => setSort(Sort.Name)}>{t("sort-by-name")}</CardAction>
          <CardAction onClick={() => setSort(Sort.LastUpdate)}>
            {t("sort-by-last-update")}
          </CardAction>
          <CardAction onClick={() => setSort(Sort.Percentage)}>
            {t("sort-by-percentage")}
          </CardAction>
        </CardActions>
        {guildMembers.map((member) => (
          <TiersListItem
            key={member.id}
            href={`/guild/tiers-list/${id}/${member.id}`}
            name={member.playerName}
            lastUpdate={member.heroesLastUpdate}
            percentage={member.percentage}
            heroName={member.firstKoHero}
          />
        ))}
      </Card>
    </>
  );
};

export default withLayoutPrivate(TiersList);
