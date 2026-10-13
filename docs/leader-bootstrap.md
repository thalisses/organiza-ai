# Bootstrap da liderança da cidade

A primeira conta `lider_cidade` só pode ser provisionada por uma pessoa autorizada da equipe, usando uma conexão administrativa confiável ao banco. Não existe controle de cadastro público nem uso de chave administrativa no frontend para essa operação.

## Provisionamento inicial

1. A pessoa escolhida cria uma conta pela interface normal e confirma o endereço de e-mail usado para identificá-la.
2. Uma pessoa operadora abre o SQL Editor do projeto Supabase ou uma conexão administrativa aprovada. Para o ambiente local, use o SQL Editor local. Não execute o procedimento com a chave publishable da aplicação.
3. Execute o bloco abaixo substituindo `EMAIL_CONFIRMADO` pelo endereço confirmado. O bloco exige exatamente uma conta Auth e só altera um perfil participante da cidade piloto; se qualquer condição falhar, a transação é revertida.

```sql
do $$
declare
	selected_user_id uuid;
begin
	select auth_user.id
	into strict selected_user_id
	from auth.users as auth_user
	where lower(auth_user.email) = lower('EMAIL_CONFIRMADO');

	update public.profiles as profile
	set role = 'lider_cidade'
	where profile.id = selected_user_id
		and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
		and profile.role = 'participante';

	if not found then
		raise exception 'A conta não é um perfil participante da cidade piloto.';
	end if;
end;
$$;
```

4. Verifique no resultado de uma consulta administrativa que o perfil esperado tem `role = 'lider_cidade'` e `city_id` da cidade Maringá. Se o e-mail, papel ou cidade não corresponder, interrompa e investigue; não altere diretamente outros perfis.
5. A nova liderança entra pela interface e atribui/remove `lider_setor` no painel **Lideranças de setor**. A função do banco valida novamente o papel de quem chama e o alvo da mudança.

## Regras de segurança

- O cadastro e os metadados enviados pelo cliente sempre criam `participante`; eles não concedem papéis elevados.
- Clientes autenticados não recebem permissão direta de `UPDATE` na coluna `profiles.role`.
- Apenas a função `public.set_sector_leader` aceita promover um participante a líder de setor ou remover esse papel; ela não altera `lider_cidade` nem perfis de outra cidade.
- Nunca coloque chave `service_role`, senha do banco ou credencial administrativa no bundle web, em `.env` versionado ou em instruções compartilhadas.
- Registre a execução segundo o processo de auditoria operacional da equipe, sem registrar senha, token ou WhatsApp completo.