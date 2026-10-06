package com.hxh.apboa.console.account;

import com.hxh.apboa.account.service.AccountService;
import com.hxh.apboa.account.service.AccountTenantService;
import com.hxh.apboa.common.config.auth.ChatKeyAccess;
import com.hxh.apboa.common.config.auth.RoleNeed;
import com.hxh.apboa.common.config.auth.SkAccess;
import com.hxh.apboa.common.consts.SysConst;
import com.hxh.apboa.common.dto.AccountDTO;
import com.hxh.apboa.common.dto.RegisterRequest;
import com.hxh.apboa.common.entity.Account;
import com.hxh.apboa.common.entity.AccountTenant;
import com.hxh.apboa.common.enums.TenantRole;
import com.hxh.apboa.common.exception.BusinessException;
import com.hxh.apboa.common.r.R;
import com.hxh.apboa.common.util.BeanUtils;
import com.hxh.apboa.common.util.UserUtils;
import com.hxh.apboa.common.vo.AccountVO;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 账号Controller
 *
 * @author huxuehao
 */
@RestController
@RequestMapping("/account")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;
    private final AccountTenantService accountTenantService;

    /**
     * list查询
     */
    @GetMapping("/list")
    public R<List<AccountVO>> list(AccountDTO query) {
        List<AccountTenant> memberships = accountTenantService.listByTenantId(UserUtils.getTenantId());
        if (memberships.isEmpty()) {
            return R.data(List.of());
        }
        Map<Long, AccountTenant> membershipByAccount = memberships.stream()
                .collect(Collectors.toMap(AccountTenant::getAccountId, Function.identity(), (left, right) -> left));
        List<Account> list = accountService.listByIds(membershipByAccount.keySet()).stream()
                .filter(account -> matches(query.getNickname(), account.getNickname()))
                .filter(account -> matches(query.getEmail(), account.getEmail()))
                .filter(account -> matches(query.getUsername(), account.getUsername()))
                .filter(account -> query.getEnabled() == null || Objects.equals(query.getEnabled(), account.getEnabled()))
                .toList();
        List<AccountVO> accounts = BeanUtils.copyList(list, AccountVO.class);
        accounts.forEach(account -> {
            AccountTenant membership = membershipByAccount.get(account.getId());
            if (membership != null && membership.getRole() != null) {
                account.setTenantRole(membership.getRole().name());
            }
        });
        return R.data(accounts);
    }

    /**
     * 详情
     */
    @SkAccess
    @ChatKeyAccess
    @GetMapping("/{id}")
    public R<AccountVO> detail(@PathVariable("id") Long id) {
        Account entity = accountService.getById(id);
        if (entity == null) {
            throw new BusinessException("用户不存在");
        }
        AccountVO account = BeanUtils.copy(entity, AccountVO.class);
        return R.data(account);
    }

    /**
     * 新增
     */
    @PostMapping
    @RoleNeed({TenantRole.TENANT_ADMIN})
    public R<Boolean> save(@RequestBody Account entity) {
        RegisterRequest request = BeanUtils.copy(entity, RegisterRequest.class);
        return R.data(accountService.registerByAdmin(request, UserUtils.getTenantId()));
    }

    /**
     * 删除
     */
    @DeleteMapping
    @RoleNeed({TenantRole.TENANT_ADMIN})
    @Transactional(rollbackFor = Exception.class)
    public R<Boolean> delete(@RequestBody List<Long> ids) {
        for (Account account : accountService.listByIds(ids)) {
            if (Objects.equals(account.getId(), SysConst.ADMIN_ACCOUNT_ID)) {
                throw new BusinessException("管理员账号不可删除");
            }
            if (Objects.equals(account.getId(), UserUtils.getId())) {
                throw new BusinessException("不能删除当前登录账号");
            }
            requireManagedMember(account.getId());
            if (accountTenantService.lambdaQuery().eq(AccountTenant::getAccountId, account.getId()).count() > 1) {
                throw new BusinessException("账号仍属于其他组织，不能从当前组织永久删除");
            }
            accountTenantService.removeById(requireManagedMember(account.getId()).getId());
        }
        return R.data(accountService.removeByIds(ids));
    }

    /**
     * 禁用/激活用户
     */
    @RoleNeed({TenantRole.TENANT_ADMIN})
    @PutMapping("/{id}/toggle-enabled")
    public R<Boolean> toggleEnabled(@PathVariable("id") Long id, @RequestParam("enabled") Boolean enabled) {
        requireManagedMember(id);
        if (Objects.equals(id, UserUtils.getId())) {
            throw new BusinessException("不能禁用当前登录账号");
        }
        return R.data(accountService.toggleEnabled(id, enabled));
    }

    /**
     * 管理员修改用户密码
     */
    @RoleNeed({TenantRole.TENANT_ADMIN})
    @PutMapping("/{id}/change-password")
    public R<Boolean> adminChangePassword(@PathVariable("id") Long id, @RequestParam("newPassword") String newPassword) {
        requireManagedMember(id);
        return R.data(accountService.adminChangePassword(id, newPassword));
    }

    private AccountTenant requireManagedMember(Long accountId) {
        AccountTenant membership = accountTenantService.getByAccountAndTenant(accountId, UserUtils.getTenantId());
        if (membership == null) {
            throw new BusinessException("账号不属于当前组织");
        }
        return membership;
    }

    private boolean matches(String expected, String actual) {
        return expected == null || expected.isBlank()
                || (actual != null && actual.toLowerCase(Locale.ROOT).contains(expected.trim().toLowerCase(Locale.ROOT)));
    }
}
